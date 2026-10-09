# -*- coding: utf-8 -*-
# 外网(Claude基线) vs 内网(Qwen) Gp_EcuStpStdn lld_design.json 系统对比
import json, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

A = json.load(open('测试产出/Gp_EcuStpStdn/lld_design.json', encoding='utf-8'))   # 外网基线
B = json.load(open('内网测试/Gp_EcuStpStdn_qwen/lld_design.json', encoding='utf-8'))  # 内网 Qwen

def fnmap(d):
    m = {}
    for f in d.get('providedFunctions', []) + d.get('internalFunctions', []):
        m[f['name']] = f
    return m

fa, fb = fnmap(A), fnmap(B)
print('===== 0. 顶层键 =====')
print('外网:', sorted(A.keys()))
print('内网:', sorted(B.keys()))

print('\n===== 1. 函数清单 =====')
print(f'外网 {len(fa)} 个: {sorted(fa)}')
print(f'内网 {len(fb)} 个: {sorted(fb)}')
print('仅外网:', sorted(set(fa)-set(fb)), ' 仅内网:', sorted(set(fb)-set(fa)))

print('\n===== 2. 流程图规模（节点/边/行数）=====')
def fcstat(src):
    if not src: return None
    lines = [l for l in src.split('\n') if l.strip()]
    edges = len(re.findall(r'-->|---|~~~', src))
    nodes = len(set(re.findall(r'^\s*(\w+)[\[{(]', src, re.M)))
    cond = len(re.findall(r'subgraph', src))
    return (len(lines), nodes, edges, cond)
print(f'{"函数":44} {"外网 行/点/边/框":>18} {"内网 行/点/边/框":>18}')
for n in sorted(set(fa)|set(fb)):
    a = fcstat((fa.get(n,{}).get('generated') or {}).get('flowchart'))
    b = fcstat((fb.get(n,{}).get('generated') or {}).get('flowchart'))
    print(f'{n:44} {str(a):>18} {str(b):>18}')

print('\n===== 3. 描述长度 =====')
for n in sorted(set(fa)&set(fb)):
    ga = fa[n].get('generated') or {}
    gb = fb[n].get('generated') or {}
    da = len(ga.get('detailedDescription') or ga.get('description') or '')
    db = len(gb.get('detailedDescription') or gb.get('description') or '')
    va = len(ga.get('valueEffect') or '')
    vb = len(gb.get('valueEffect') or '')
    print(f'{n:44} desc {da:5}->{db:5}  valueEffect {va:4}->{vb:4}')

print('\n===== 4. 类型 =====')
ta = {t['name']: t for t in A.get('types', [])}
tb = {t['name']: t for t in B.get('types', [])}
print('外网类型:', sorted(ta), ' 内网:', sorted(tb))
for n in sorted(set(ta)&set(tb)):
    ca = ((ta[n].get('generated') or {}).get('comment') or ta[n].get('comment') or '')
    cb = ((tb[n].get('generated') or {}).get('comment') or tb[n].get('comment') or '')
    print(f'  {n}: 外网注释 {len(ca)} 字 / 内网 {len(cb)} 字')

print('\n===== 5. 外部接口/Callout =====')
for key in ['externalInterfaces', 'callouts', 'calloutFunctions']:
    ea = A.get(key) or []
    eb = B.get(key) or []
    if ea or eb:
        na = sorted(e.get('name','?') for e in ea)
        nb = sorted(e.get('name','?') for e in eb)
        print(f'{key}: 外网{len(ea)} 内网{len(eb)} 仅外网{sorted(set(na)-set(nb))} 仅内网{sorted(set(nb)-set(na))}')

print('\n===== 6. 动态设计 =====')
sa = (A.get('dynamicDesign') or {}).get('stateMachine')
sb = (B.get('dynamicDesign') or {}).get('stateMachine')
def smsum(s):
    if not s: return None
    return {'states': [x.get('name') for x in s.get('states', [])], 'trans': len(s.get('transitions', [])), 'diagram_len': len(s.get('stateDiagram') or '')}
print('外网 SM:', smsum(sa))
print('内网 SM:', smsum(sb))
qa = (A.get('dynamicDesign') or {}).get('sequences') or []
qb = (B.get('dynamicDesign') or {}).get('sequences') or []
print(f'序列图: 外网 {len(qa)} 张 {[s.get("name") for s in qa]}')
print(f'        内网 {len(qb)} 张 {[s.get("name") for s in qb]}')
for s in qb:
    src = s.get('mermaid') or s.get('diagram') or ''
    frags = len(re.findall(r'^\s*(alt|opt|loop|par)\b', src, re.M))
    print(f'  内网 {s.get("name")}: {len(src)} 字符, 组合片段 {frags}')
for s in qa:
    src = s.get('mermaid') or s.get('diagram') or ''
    frags = len(re.findall(r'^\s*(alt|opt|loop|par)\b', src, re.M))
    print(f'  外网 {s.get("name")}: {len(src)} 字符, 组合片段 {frags}')

print('\n===== 7. 5.1 功能描述 =====')
da = (A.get('functionalDescription') or (A.get('moduleDescription') or {}).get('generated') or '')
db_ = (B.get('functionalDescription') or (B.get('moduleDescription') or {}).get('generated') or '')
print(f'外网 {len(str(da))} 字 / 内网 {len(str(db_))} 字')

print('\n===== 8. 配置宏 =====')
ca = A.get('configurations') or A.get('configs') or []
cb = B.get('configurations') or B.get('configs') or []
print(f'外网 {len(ca)} / 内网 {len(cb)}')
