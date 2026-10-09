# -*- coding: utf-8 -*-
# lintFlowchartStructure 真阳性批量修复（2026-09-08）
# 每个 patch 断言恰好命中 1 次，防误改
import json, io, sys, shutil, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def load(p, bak):
    shutil.copy(p, bak)
    d = json.load(open(p, encoding='utf-8'))
    fns = {f['name']: f for f in d['providedFunctions'] + d['internalFunctions']}
    return d, fns

def patch(fns, name, old, new):
    fc = fns[name]['generated']['flowchart']
    n = fc.count(old)
    assert n == 1, f'{name}: expect 1 got {n}: {old[:70]!r}'
    fns[name]['generated']['flowchart'] = fc.replace(old, new)
    print(f'[OK] {name}')

# ================= EcuStp =================
p1 = '内网测试/Gp_EcuStpStdn_qwen/lld_design.json'
d1, f1 = load(p1, p1.replace('.json', '.bak7-结构修前.json'))

# Startup: STAGE2_COMMON_START 幽灵汇合点 -> 补空白声明 + 透明样式
patch(f1, 'Gp_EcuStpShdn_Startup',
      '    SET_STAGE2 --> STAGE2_COMMON_START\n',
      '    STAGE2_COMMON_START[" "]\n    SET_STAGE2 --> STAGE2_COMMON_START\n')
patch(f1, 'Gp_EcuStpShdn_Startup',
      '    style WAIT_STAGE2_J fill:transparent,stroke:transparent\n',
      '    style WAIT_STAGE2_J fill:transparent,stroke:transparent\n    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n')

json.dump(d1, open(p1, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written', p1)

# ================= IoM =================
p2 = '内网测试/Gp_IoMcuAdc_qwen/lld_design.json'
d2, f2 = load(p2, p2.replace('.json', '.bak7-结构修前.json'))

# MainFunction: AssignRt 断链 -> 接到 CheckInit
patch(f2, 'Gp_IoMcuAdc_MainFunction',
      '    AssignCfg --> AssignRt["赋值 Rt_cptst<br>指向当前核心运行时缓冲区"]\n',
      '    AssignCfg --> AssignRt["赋值 Rt_cptst<br>指向当前核心运行时缓冲区"]\n    AssignRt --> CheckInit\n')

# GetAdcSigDiag / GetAdcSigAdcRaw: START 悬空 -> 接 INIT
for nm in ['Gp_IoMcuAdc_GetAdcSigDiag', 'Gp_IoMcuAdc_GetAdcSigAdcRaw']:
    patch(f2, nm, '    START(["开始"])\n', '    START(["开始"]) --> INIT\n')

# CheckAdcRawValidity: MERGE1/2/3 幽灵 -> 补空白声明 + 透明样式（沿用 MERGE4 汇合点约定）
patch(f2, 'Gp_IoMcuAdc_CheckAdcRawValidity',
      '    MERGE1 --> RETURN["返回 Validity_b"]\n',
      '    MERGE1[" "]\n    MERGE2[" "]\n    MERGE3[" "]\n'
      '    style MERGE1 fill:transparent,stroke:transparent\n'
      '    style MERGE2 fill:transparent,stroke:transparent\n'
      '    style MERGE3 fill:transparent,stroke:transparent\n'
      '    MERGE1 --> RETURN["返回 Validity_b"]\n')

json.dump(d2, open(p2, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written', p2)

# ================= TLF =================
p3 = '内网测试/Gp_TLF35584_qwen/lld_design.json'
d3, f3 = load(p3, p3.replace('.json', '.bak7-结构修前.json'))

# SetWkUpTimer: START 悬空 + INIT/ASSIGN 脱链 -> START-->INIT-->ASSIGN-->CHECK
patch(f3, 'Gp_TLF35584_SetWkUpTimer',
      '    START(["开始"])\n',
      '    START(["开始"]) --> INIT\n    INIT --> ASSIGN\n    ASSIGN --> CHECK\n')

# ClearFlagReg / WwdBist / SingleOvSafetyPathBist / AllCompartorSafetyCmd: START 悬空 -> 接首节点
patch(f3, 'Gp_TLF35584_ClearFlagReg', '    START(["开始"])\n', '    START(["开始"]) --> INIT1\n')
patch(f3, 'Gp_TLF35584_WwdBist', '    START(["开始"])\n', '    START(["开始"]) --> INIT\n')
patch(f3, 'Gp_TLF35584_SingleOvSafetyPathBist', '        START(["开始"])\n', '        START(["开始"]) --> INIT\n')
patch(f3, 'Gp_TLF35584_AllCompartorSafetyCmd', '        START(["开始"])\n', '        START(["开始"]) --> INIT\n')

# SetPorstMode: 删 14 条幽灵重复链（LANE_*_CALC 等从未声明的 id），LOCK_FWD/LOCK_WWD 接 MERGE；
# SG1_END 幽灵汇合点补空白声明 + 透明样式
fc = f3['Gp_TLF35584_SetPorstMode']['generated']['flowchart']
lines = fc.split('\n')
phantom = [l for l in lines if re.match(r'^\s*LANE_(FWD|WWD)_\w+\s*-->\s*(LANE_(FWD|WWD)_\w+|MERGE)\s*$', l)]
assert len(phantom) == 14, f'expect 14 phantom lines, got {len(phantom)}'
lines = [l for l in lines if l not in phantom]
fc = '\n'.join(lines)
assert fc.count('    MERGE[["Gp_TLF35584_CalloutStmSwDalayNus 延时 GP_TLF35584_MODE_SWITCH_DELAY"]]\n') == 1
fc = fc.replace('    MERGE[["Gp_TLF35584_CalloutStmSwDalayNus 延时 GP_TLF35584_MODE_SWITCH_DELAY"]]\n',
                '    LOCK_FWD --> MERGE\n    LOCK_WWD --> MERGE\n\n    MERGE[["Gp_TLF35584_CalloutStmSwDalayNus 延时 GP_TLF35584_MODE_SWITCH_DELAY"]]\n')
assert fc.count('        DEM_CHECK -- 否 --> SG1_END\n') == 1
fc = fc.replace('        DEM_CHECK -- 否 --> SG1_END\n',
                '        SG1_END[" "]\n        DEM_CHECK -- 否 --> SG1_END\n')
assert fc.count('    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4\n    class SG1_NOTE condNote\n') == 1
fc = fc.replace('    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4\n    class SG1_NOTE condNote\n',
                '    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4\n    class SG1_NOTE condNote\n    style SG1_END fill:transparent,stroke:transparent\n')
f3['Gp_TLF35584_SetPorstMode']['generated']['flowchart'] = fc
print('[OK] Gp_TLF35584_SetPorstMode')

# InitRegCfg: INC_LOOP3 幽灵 -> 补声明
patch(f3, 'Gp_TLF35584_InitRegCfg',
      '    INC_LOOP2["Cnt_u32++"]\n',
      '    INC_LOOP2["Cnt_u32++"]\n    INC_LOOP3["Cnt_u32++"]\n')

# Errpin_Bist: Call10 跳过 SG2 直挂 Call13，Call12 断链 -> Call10-->Call11, Call12-->Call13
patch(f3, 'Gp_TLF35584_Errpin_Bist',
      '    Call10 --> Call13[["Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN)"]]\n',
      '    Call10 --> Call11\n    Call12 --> Call13[["Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN)"]]\n')

# FwdSpiService: SUBx_START 隐形汇合点补透明样式（空白盒不应可见）
fc = f3['Gp_TLF35584_FwdSpiService']['generated']['flowchart']
for i in range(4):
    old = f'    style LANE_{i} fill:transparent,stroke:transparent\n'
    assert fc.count(old) == 1, f'LANE_{i} style'
    fc = fc.replace(old, old + f'    style SUB{i}_START fill:transparent,stroke:transparent\n')
f3['Gp_TLF35584_FwdSpiService']['generated']['flowchart'] = fc
print('[OK] Gp_TLF35584_FwdSpiService')

json.dump(d3, open(p3, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written', p3)
