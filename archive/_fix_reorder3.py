# -*- coding: utf-8 -*-
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
p = '内网测试/Gp_TLF35584_qwen/lld_design.json'
d = json.load(open(p, encoding='utf-8'))
fns = {f['name']: f for f in d['providedFunctions']+d['internalFunctions']}

# ===== fig54 AllSafety: 嫁接基线骨架（基线同名图实测 0 交叉），保留 Qwen 详细标签 =====
all_new = '''flowchart TD
    subgraph SG1[" "]
        direction TB
        SG1_NOTE["注：仅在 GP_TLF35584_ANA_BIST_ENABLE 生效时参与编译"]
        SG1_NOTE ~~~ START
        START(["开始"]) --> INIT{{"初始化 Data_pst, AbistCtrl0_u8, Monsf1_u8, Monsf2_u8, Monsf3_u8, Ret_t"}}
        INIT --> CALL_START[["Gp_TimeCal_CaptureStart 启动计时"]]
        CALL_START --> D0{"Ret_t == E_NOT_OK ?"}
        D0 -- 是 --> C1[["Gp_TimeCal_CaptureStop 停止计时"]]
        C1 --> D1{"Interval_Us_f32 > GP_TLF35584_ABIST_MULTI_MAXTIME ?"}
        D1 -- 是 --> END(["结束"])
        D1 -- 否 --> R1[/"写入 TxBuf_au16 读取命令 MONSF1, MONSF2, MONSF3, ABIST_CTRL0"/]
        R1 --> R2["设置 CntTx_u16 = 4U"]
        R2 --> R3[["Gp_TLF35584_TransmitData 发送数据"]]
        R3 --> R4[/"读取 RxBuf_au16 并赋值给 Monsf1_u8, Monsf2_u8, Monsf3_u8, AbistCtrl0_u8"/]
        R4 --> D2{"(AbistCtrl0_u8 & GP_TLF35584_BIST_SUCCEED) == GP_TLF35584_BIST_SUCCEED ?"}
        D2 -- 是 --> P0["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_4"]
        P0 --> D3{"(Monsf1_u8 & GP_TLF35584_MONSF1_MASK) == GP_TLF35584_MONSF1_MASK ?"}
        D3 -- 是 --> P1["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_5"]
        P1 --> D4{"(Monsf2_u8 & GP_TLF35584_MONSF2_MASK) == GP_TLF35584_MONSF2_MASK ?"}
        D4 -- 是 --> P2["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_6"]
        P2 --> D5{"(Monsf3_u8 & GP_TLF35584_MONSF3_MASK) == GP_TLF35584_MONSF3_MASK ?"}
        D5 -- 是 --> P3["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_7<br>Ret_t = E_OK"]
        D5 -- 否 --> E7["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_7"]
        D4 -- 否 --> E6["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_6"]
        D3 -- 否 --> E5["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_5"]
        D2 -- 否 --> E4["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_4"]
        P3 --> D0
        E7 --> D0
        E6 --> D0
        E5 --> D0
        E4 --> D0
        D0 -- 否 --> END
    end
    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4
    classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700
    class SG1_NOTE condNote'''
fns['Gp_TLF35584_AllSafetyBistCheck']['generated']['flowchart'] = all_new
print('[OK] AllSafety graft baseline skeleton')

# ===== fig23 TransmitData: 删 BREAK_INNER / BREAK_OUTER 两个多余 break 节点 =====
fc = fns['Gp_TLF35584_TransmitData']['generated']['flowchart']
def rep(old, new):
    global fc
    assert fc.count(old) == 1, f'expect 1: {old[:50]!r}'
    fc = fc.replace(old, new)

rep('    BREAK_INNER["跳出内层循环"]\n', '')
rep('    BREAK_OUTER["跳出外层循环"]\n', '')
rep('    SET_FLAG_ERR --> BREAK_INNER\n    BREAK_INNER --> CHECK_FLAG\n',
    '    SET_FLAG_ERR --> CHECK_FLAG\n')
rep('    CLEAR_ERR --> BREAK_OUTER\n    BREAK_OUTER --> END\n',
    '    CLEAR_ERR --> END\n')
fns['Gp_TLF35584_TransmitData']['generated']['flowchart'] = fc
print('[OK] TransmitData drop break nodes')

json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written')
