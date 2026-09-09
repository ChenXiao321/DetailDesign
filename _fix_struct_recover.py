# -*- coding: utf-8 -*-
# 恢复脚本：EcuStp 去重 + 重建 EcuStp/IoM 的 .bak7（结构修前状态）
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ---- EcuStp：去重 ----
p1 = '内网测试/Gp_EcuStpStdn_qwen/lld_design.json'
d1 = json.load(open(p1, encoding='utf-8'))
f1 = {x['name']: x for x in d1['providedFunctions'] + d1['internalFunctions']}
fc = f1['Gp_EcuStpShdn_Startup']['generated']['flowchart']
assert fc.count('    STAGE2_COMMON_START[" "]\n    STAGE2_COMMON_START[" "]\n') == 1
fc = fc.replace('    STAGE2_COMMON_START[" "]\n    STAGE2_COMMON_START[" "]\n', '    STAGE2_COMMON_START[" "]\n')
assert fc.count('    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n') == 1
fc = fc.replace('    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n',
                '    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n')
f1['Gp_EcuStpShdn_Startup']['generated']['flowchart'] = fc
json.dump(d1, open(p1, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[OK] EcuStp dedup + written')

# ---- EcuStp bak7 重建（逆掉 Startup 两处补丁）----
bak1 = json.loads(json.dumps(d1))
bf1 = {x['name']: x for x in bak1['providedFunctions'] + bak1['internalFunctions']}
bfc = bf1['Gp_EcuStpShdn_Startup']['generated']['flowchart']
assert bfc.count('    STAGE2_COMMON_START[" "]\n') == 1
bfc = bfc.replace('    STAGE2_COMMON_START[" "]\n', '')
assert bfc.count('    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n') == 1
bfc = bfc.replace('    style STAGE2_COMMON_START fill:transparent,stroke:transparent\n', '')
bf1['Gp_EcuStpShdn_Startup']['generated']['flowchart'] = bfc
json.dump(bak1, open(p1.replace('.json', '.bak7-结构修前.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[OK] EcuStp bak7 rebuilt')

# ---- IoM bak7 重建（逆掉 4 处补丁；当前 json 即单次补丁正确态，不动）----
p2 = '内网测试/Gp_IoMcuAdc_qwen/lld_design.json'
bak2 = json.load(open(p2, encoding='utf-8'))
bf2 = {x['name']: x for x in bak2['providedFunctions'] + bak2['internalFunctions']}
mfc = bf2['Gp_IoMcuAdc_MainFunction']['generated']['flowchart']
assert mfc.count('    AssignRt --> CheckInit\n') == 1
bf2['Gp_IoMcuAdc_MainFunction']['generated']['flowchart'] = mfc.replace('    AssignRt --> CheckInit\n', '')
for nm in ['Gp_IoMcuAdc_GetAdcSigDiag', 'Gp_IoMcuAdc_GetAdcSigAdcRaw']:
    s = bf2[nm]['generated']['flowchart']
    assert s.count('    START(["开始"]) --> INIT\n') == 1
    bf2[nm]['generated']['flowchart'] = s.replace('    START(["开始"]) --> INIT\n', '    START(["开始"])\n')
cfc = bf2['Gp_IoMcuAdc_CheckAdcRawValidity']['generated']['flowchart']
add = ('    MERGE1[" "]\n    MERGE2[" "]\n    MERGE3[" "]\n'
       '    style MERGE1 fill:transparent,stroke:transparent\n'
       '    style MERGE2 fill:transparent,stroke:transparent\n'
       '    style MERGE3 fill:transparent,stroke:transparent\n')
assert cfc.count(add) == 1
bf2['Gp_IoMcuAdc_CheckAdcRawValidity']['generated']['flowchart'] = cfc.replace(add, '')
json.dump(bak2, open(p2.replace('.json', '.bak7-结构修前.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('[OK] IoM bak7 rebuilt')
