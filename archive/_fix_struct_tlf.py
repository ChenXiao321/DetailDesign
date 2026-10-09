# -*- coding: utf-8 -*-
# TLF 结构修复（_fix_struct.py 的 TLF 段，单独跑；bak7 已在上次运行中正确备份）
import json, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

p3 = '内网测试/Gp_TLF35584_qwen/lld_design.json'
d3 = json.load(open(p3, encoding='utf-8'))
f3 = {x['name']: x for x in d3['providedFunctions'] + d3['internalFunctions']}

def patch(name, old, new):
    fc = f3[name]['generated']['flowchart']
    n = fc.count(old)
    assert n == 1, f'{name}: expect 1 got {n}: {old[:70]!r}'
    f3[name]['generated']['flowchart'] = fc.replace(old, new)
    print(f'[OK] {name}')

# SetWkUpTimer: START 悬空 + INIT/ASSIGN 脱链 -> START-->INIT-->ASSIGN-->CHECK
patch('Gp_TLF35584_SetWkUpTimer',
      '    START(["开始"])\n',
      '    START(["开始"]) --> INIT\n    INIT --> ASSIGN\n    ASSIGN --> CHECK\n')

# START 悬空 -> 接首节点
patch('Gp_TLF35584_ClearFlagReg', '    START(["开始"])\n', '    START(["开始"]) --> INIT1\n')
patch('Gp_TLF35584_WwdBist', '    START(["开始"])\n', '    START(["开始"]) --> INIT\n')
patch('Gp_TLF35584_SingleOvSafetyPathBist', '        START(["开始"])\n', '        START(["开始"]) --> INIT\n')
patch('Gp_TLF35584_AllCompartorSafetyCmd', '        START(["开始"])\n', '        START(["开始"]) --> INIT\n')

# SetPorstMode: 删 14 条幽灵重复链，LOCK_FWD/LOCK_WWD 接 MERGE；SG1_END 补空白声明+透明样式
fc = f3['Gp_TLF35584_SetPorstMode']['generated']['flowchart']
lines = fc.split('\n')
phantom = [l for l in lines if re.match(r'^\s*LANE_(FWD|WWD)_\w+\s*-->\s*(LANE_(FWD|WWD)_\w+|MERGE)\s*$', l)]
assert len(phantom) == 15, f'expect 15 phantom lines, got {len(phantom)}'
drop = set(map(id, phantom))
lines = [l for l in lines if id(l) not in drop]
fc = '\n'.join(lines)
old_merge = '    MERGE[["Gp_TLF35584_CalloutStmSwDalayNus 延时 GP_TLF35584_MODE_SWITCH_DELAY"]]\n'
assert fc.count(old_merge) == 1
fc = fc.replace(old_merge, '    LOCK_FWD --> MERGE\n    LOCK_WWD --> MERGE\n\n' + old_merge)
old_end = '        DEM_CHECK -- 否 --> SG1_END\n'
assert fc.count(old_end) == 1
fc = fc.replace(old_end, '        SG1_END[" "]\n' + old_end)
old_style = '    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4\n    class SG1_NOTE condNote\n'
assert fc.count(old_style) == 1
fc = fc.replace(old_style, old_style + '    style SG1_END fill:transparent,stroke:transparent\n')
f3['Gp_TLF35584_SetPorstMode']['generated']['flowchart'] = fc
print('[OK] Gp_TLF35584_SetPorstMode')

# InitRegCfg: INC_LOOP3 幽灵 -> 补声明
patch('Gp_TLF35584_InitRegCfg',
      '    INC_LOOP2["Cnt_u32++"]\n',
      '    INC_LOOP2["Cnt_u32++"]\n    INC_LOOP3["Cnt_u32++"]\n')

# Errpin_Bist: Call10 跳过 SG2 直挂 Call13，Call12 断链 -> Call10-->Call11, Call12-->Call13
patch('Gp_TLF35584_Errpin_Bist',
      '    Call10 --> Call13[["Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN)"]]\n',
      '    Call10 --> Call11\n    Call12 --> Call13[["Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN)"]]\n')

# FwdSpiService: SUBx_START 隐形汇合点补透明样式
fc = f3['Gp_TLF35584_FwdSpiService']['generated']['flowchart']
for i in range(4):
    old = f'    style LANE_{i} fill:transparent,stroke:transparent\n'
    assert fc.count(old) == 1, f'LANE_{i} style'
    fc = fc.replace(old, old + f'    style SUB{i}_START fill:transparent,stroke:transparent\n')
f3['Gp_TLF35584_FwdSpiService']['generated']['flowchart'] = fc
print('[OK] Gp_TLF35584_FwdSpiService')

json.dump(d3, open(p3, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written', p3)
