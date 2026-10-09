# -*- coding: utf-8 -*-
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
p = '内网测试/Gp_TLF35584_qwen/lld_design.json'
d = json.load(open(p, encoding='utf-8'))
fns = {f['name']: f for f in d['providedFunctions']+d['internalFunctions']}

sin_new = '''flowchart TD
    subgraph SG1[" "]
        SG1_NOTE["注：仅在 GP_TLF35584_ANA_BIST_ENABLE 生效时参与编译"]
        SG1_NOTE ~~~ START
        START(["开始"])
        START --> INIT
        INIT{{"初始化变量<br>Data_pst 指向 Gp_TLF35584_rtData_ltst<br>AbistCtrl0_u8 = 0U<br>AbistSlect0_u8 = 0U<br>Monsf1_u8 = 0U<br>Ret_t = E_NOT_OK"}}
        INIT --> CALL_START[["Gp_TimeCal_CaptureStart<br>启动时间校准捕获"]]
        CALL_START --> LOOP_CHECK{"Ret_t == E_NOT_OK ?"}
        LOOP_CHECK -- 是 --> CALL_STOP[["Gp_TimeCal_CaptureStop<br>停止时间校准捕获"]]
        CALL_STOP --> CHECK_TIME{"Gp_TLF35584_SingAnalogBistCal_lst.Interval_Us_f32 > GP_TLF35584_ABIST_SINGLE_MAXTIME ?"}
        CHECK_TIME -- 是 --> RETURN_RET[/"返回 Ret_t"/]
        CHECK_TIME -- 否 --> READ_REG1[/"读取寄存器 GP_TLF35584_REG_MONSF1<br>存入 TxBuf_au16[0U]"/]
        READ_REG1 --> READ_REG2[/"读取寄存器 GP_TLF35584_REG_ABIST_CTRL0<br>存入 TxBuf_au16[1U]"/]
        READ_REG2 --> READ_REG3[/"读取寄存器 GP_TLF35584_REG_ABIST_SELECT0<br>存入 TxBuf_au16[2U]"/]
        READ_REG3 --> SET_CNT["设置 CntTx_u16 = 3U"]
        SET_CNT --> CALL_TX[["Gp_TLF35584_TransmitData<br>发送 SPI 数据"]]
        CALL_TX --> PARSE_DATA["解析接收数据<br>Monsf1_u8 = RxBuf_au16[0U] & 0xFF<br>AbistCtrl0_u8 = RxBuf_au16[1U] & 0xFF<br>AbistSlect0_u8 = RxBuf_au16[2U] & 0xFF"]
        PARSE_DATA --> CHECK_CTRL{"(AbistCtrl0_u8 & GP_TLF35584_BIST_SUCCEED) == GP_TLF35584_BIST_SUCCEED ?"}
        CHECK_CTRL -- 是 --> CLEAR_ERR0["清除错误标志<br>BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_0"]
        CLEAR_ERR0 --> CHECK_SELECT{"(AbistSlect0_u8 & GP_TLF35584_UCOV_SELECT0) == GP_TLF35584_NO_ERROR ?"}
        CHECK_SELECT -- 是 --> CLEAR_ERR1["清除错误标志<br>BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_1"]
        CLEAR_ERR1 --> CHECK_MONSF1{"(Monsf1_u8 & GP_TLF35584_UCOV_MONSF1) == GP_TLF35584_UCOV_MONSF1 ?"}
        CHECK_MONSF1 -- 是 --> CLEAR_ERR2["清除错误标志<br>BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_2"]
        CLEAR_ERR2 --> SET_OK["设置成功状态<br>Ret_t = E_OK"]
        SET_OK --> LOOP_CHECK
        CHECK_MONSF1 -- 否 --> SET_ERR2["设置错误标志<br>Ret_t |= E_NOT_OK<br>BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_2"]
        CHECK_SELECT -- 否 --> SET_ERR1["设置错误标志<br>Ret_t |= E_NOT_OK<br>BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_1"]
        CHECK_CTRL -- 否 --> SET_ERR0["设置错误标志<br>Ret_t |= E_NOT_OK<br>BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_0"]
        SET_ERR2 --> LOOP_CHECK
        SET_ERR1 --> LOOP_CHECK
        SET_ERR0 --> LOOP_CHECK
        LOOP_CHECK -- 否 --> RETURN_RET
        RETURN_RET --> END(["结束"])
    end
    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4
    classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700
    class SG1_NOTE condNote'''
fns['Gp_TLF35584_SinSafetyBistCheck']['generated']['flowchart'] = sin_new
print('[OK] SinSafety reorder')

all_new = '''flowchart TD
    subgraph SG1[" "]
        SG1_NOTE["注：仅在 GP_TLF35584_ANA_BIST_ENABLE 生效时参与编译"]
        SG1_NOTE ~~~ START
        START(["开始"])
        START --> INIT
        INIT{{"初始化 Data_pst, AbistCtrl0_u8, Monsf1_u8, Monsf2_u8, Monsf3_u8, Ret_t"}}
        INIT --> CALL_START[["Gp_TimeCal_CaptureStart 启动计时"]]
        CALL_START --> LOOP_COND{"Ret_t == E_NOT_OK ?"}
        LOOP_COND -- 是 --> CALL_STOP[["Gp_TimeCal_CaptureStop 停止计时"]]
        CALL_STOP --> TIME_CHECK{"Interval_Us_f32 > GP_TLF35584_ABIST_MULTI_MAXTIME ?"}
        TIME_CHECK -- 是 --> BREAK_LOOP
        TIME_CHECK -- 否 --> WRITE_TX[/"写入 TxBuf_au16 读取命令 MONSF1, MONSF2, MONSF3, ABIST_CTRL0"/]
        WRITE_TX --> SET_CNT["设置 CntTx_u16 = 4U"]
        SET_CNT --> CALL_TX[["Gp_TLF35584_TransmitData 发送数据"]]
        CALL_TX --> READ_RX[/"读取 RxBuf_au16 并赋值给 Monsf1_u8, Monsf2_u8, Monsf3_u8, AbistCtrl0_u8"/]
        READ_RX --> CHECK_CTRL{"(AbistCtrl0_u8 & GP_TLF35584_BIST_SUCCEED) == GP_TLF35584_BIST_SUCCEED ?"}
        CHECK_CTRL -- 是 --> CLEAR_ERR4["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_4"]
        CLEAR_ERR4 --> CHECK_M1{"(Monsf1_u8 & GP_TLF35584_MONSF1_MASK) == GP_TLF35584_MONSF1_MASK ?"}
        CHECK_M1 -- 是 --> CLEAR_ERR5["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_5"]
        CLEAR_ERR5 --> CHECK_M2{"(Monsf2_u8 & GP_TLF35584_MONSF2_MASK) == GP_TLF35584_MONSF2_MASK ?"}
        CHECK_M2 -- 是 --> CLEAR_ERR6["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_6"]
        CLEAR_ERR6 --> CHECK_M3{"(Monsf3_u8 & GP_TLF35584_MONSF3_MASK) == GP_TLF35584_MONSF3_MASK ?"}
        CHECK_M3 -- 是 --> CLEAR_ERR7["清除 BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_7"]
        CLEAR_ERR7 --> SET_OK["Ret_t = E_OK"]
        SET_OK --> LOOP_COND
        CHECK_M3 -- 否 --> ERR_M3["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_7"]
        CHECK_M2 -- 否 --> ERR_M2["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_6"]
        CHECK_M1 -- 否 --> ERR_M1["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_5"]
        CHECK_CTRL -- 否 --> ERR_CTRL["Ret_t |= E_NOT_OK<br>设置 BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_4"]
        ERR_M3 --> LOOP_COND
        ERR_M2 --> LOOP_COND
        ERR_M1 --> LOOP_COND
        ERR_CTRL --> LOOP_COND
        LOOP_COND -- 否 --> RETURN_RET(["结束"])
        BREAK_LOOP --> RETURN_RET
    end
    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4
    classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700
    class SG1_NOTE condNote'''
fns['Gp_TLF35584_AllSafetyBistCheck']['generated']['flowchart'] = all_new
print('[OK] AllSafety reorder')

tx_new = '''flowchart TD
    START(["开始"])
    INIT{{"初始化 Cnt_u32 = 0U"}}
    LOOP_COND{"Cnt_u32 < GP_TLF35584_TRY_REPAIR_MAX ?"}
    CALL_SPI[["Gp_TLF35584_CalloutSpiTransSync 发送SPI帧"]]
    SPI_OK{"SPI传输结果 == E_OK ?"}

    subgraph SG1[" "]
        direction TB
        SG1_NOTE["注：仅在 GP_TLF35584_DEM_ERROR_ENABLE 等于 GP_TLF35584_ENABLE 时参与编译"]
        SG1_NOTE ~~~ DEM_REPORT_1
        DEM_REPORT_1[["Gp_TLF35584_CalloutDemReport 报告SPI故障"]]
    end
    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4
    classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700
    class SG1_NOTE condNote

    subgraph SG2[" "]
        direction TB
        SG2_NOTE["注：仅在 GP_TLF35584_DEM_ERROR_ENABLE 等于 GP_TLF35584_ENABLE 时参与编译"]
        SG2_NOTE ~~~ DEM_REPORT_2
        DEM_REPORT_2[["Gp_TLF35584_CalloutDemReport 报告SPI故障"]]
    end
    style SG2 fill:transparent,stroke:#888888,stroke-dasharray:6 4
    class SG2_NOTE condNote

    SET_FLAG_OK["设置 SpiCheckFlag_u8 = GP_TLF35584_NO_ERROR"]
    INIT_IDX{{"初始化 Index_u32 = 0U"}}
    IDX_COND{"Index_u32 < TxCnt_u16 ?"}
    IS_WRITE{"TxBuf_au16[Index_u32] & GP_TLF35584_WRITE_COMMAND > 0U ?"}
    DATA_MATCH{"TxBuf_au16[Index_u32] == RxBuf_au16[Index_u32] ?"}
    SET_FLAG_ERR["设置 SpiCheckFlag_u8 = GP_TLF35584_SPI_ERR"]
    BREAK_INNER["跳出内层循环"]
    INC_IDX["Index_u32++"]

    CHECK_FLAG{"SpiCheckFlag_u8 == GP_TLF35584_NO_ERROR ?"}
    CLEAR_ERR["清除 DriverErrPath_u32 中的 SPI_ERR 位"]
    BREAK_OUTER["跳出外层循环"]
    SET_ERR_PATH["置位 DriverErrPath_u32 中的 SPI_ERR 位"]

    INC_CNT["Cnt_u32++"]
    END(["结束"])

    START --> INIT
    INIT --> LOOP_COND
    LOOP_COND -- 是 --> CALL_SPI
    CALL_SPI --> SPI_OK
    SPI_OK -- 是 --> SET_FLAG_OK
    SET_FLAG_OK --> INIT_IDX
    INIT_IDX --> IDX_COND
    IDX_COND -- 是 --> IS_WRITE
    IS_WRITE -- 是 --> DATA_MATCH
    DATA_MATCH -- 否 --> SET_FLAG_ERR
    SET_FLAG_ERR --> BREAK_INNER
    BREAK_INNER --> CHECK_FLAG
    DATA_MATCH -- 是 --> INC_IDX
    IS_WRITE -- 否 --> INC_IDX
    INC_IDX --> IDX_COND
    IDX_COND -- 否 --> CHECK_FLAG
    CHECK_FLAG -- 是 --> CLEAR_ERR
    CLEAR_ERR --> BREAK_OUTER
    BREAK_OUTER --> END
    CHECK_FLAG -- 否 --> SET_ERR_PATH
    SET_ERR_PATH --> DEM_REPORT_1
    SPI_OK -- 否 --> SET_ERR_PATH2["置位 DriverErrPath_u32 中的 SPI_ERR 位"]
    SET_ERR_PATH2 --> DEM_REPORT_2
    DEM_REPORT_1 --> INC_CNT
    DEM_REPORT_2 --> INC_CNT
    INC_CNT --> LOOP_COND
    LOOP_COND -- 否 --> END'''
fns['Gp_TLF35584_TransmitData']['generated']['flowchart'] = tx_new
print('[OK] TransmitData reorder')

json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written')
