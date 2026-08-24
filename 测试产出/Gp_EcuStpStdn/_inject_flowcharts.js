// 由 Claude 直接采样生成的 ISO 5807 流程图，注入 lld_design.json（llmModel 记为 claude-sample）
// 条件编译画法：无标题虚线 subgraph + 框内注释节点（classDef condNote，~~~ 固定位置）
const fs = require('fs');
const path = '测试产出/Gp_EcuStpStdn/lld_design.json';
const model = JSON.parse(fs.readFileSync(path, 'utf-8'));

const BOX_STYLE = 'fill:transparent,stroke:#888888,stroke-dasharray:6 4';
const NOTE_DEF = 'classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700';

const FC = {};

FC['Gp_EcuStpShdn_SetSafeState'] = `flowchart TD
    START(["开始"]) --> W[/"写 SafeState_b 为 TRUE"/]
    W --> END(["结束"])`;

FC['Gp_EcuStpShdn_SetTryPwrShdn'] = `flowchart TD
    START(["开始"]) --> W[/"写 TryPwrShdn_b 为 TRUE"/]
    W --> END(["结束"])`;

FC['Gp_EcuStpShdn_GetSafeState'] = `flowchart TD
    START(["开始"]) --> R[/"读 SafeState_b"/]
    R --> END(["返回 SafeState_b"])`;

FC['Gp_EcuStpShdn_TrapRecov'] = `flowchart TD
    START(["开始"]) --> C[["Gp_EcuStpShdn_CalloutTrapRecov<br>透传 OsStatus_u8"]]
    C --> END(["结束"])`;

FC['Gp_EcuStpShdn_OsErrRecov'] = `flowchart TD
    START(["开始"]) --> C[["Gp_EcuStpShdn_CalloutOsErrRecov<br>透传 OsStatus_u8"]]
    C --> END(["结束"])`;

FC['Gp_EcuStpShdn_PwrShdnInShdnPhase'] = `flowchart TD
    START(["开始"]) --> C[["Gp_EcuStpShdn_CalloutPwrShdnInShdnPhase"]]
    C --> END(["结束"])`;

FC['Gp_EcuStpShdn_Startup'] = `flowchart TD
    START(["开始"]) --> GETCORE[["CalloutGetCoreId<br>取本核 CoreId"]]
    GETCORE --> PREP["按 CoreId 取本核卫星运行缓冲区<br>Rt_cptst 与 SatImpl_ptst"]
    PREP --> D_CORE1{"本核是 Core0 主核"}
    D_CORE1 -- 是 --> S1M_P1
    subgraph LANE_S1M[" "]
        direction TB
        S1M_P1["InitRsltAllBits_u32 清 0"] --> S1M_H1{{"Cnt_u32 置 0"}}
        S1M_H1 --> S1M_D1{"Cnt_u32 小于<br>INIT_RSLT_REC_NUM"}
        S1M_D1 -- 是 --> S1M_B1["InitCheckRslt_t[Cnt_u32] 置 E_OK"]
        S1M_B1 --> S1M_I1["Cnt_u32 加 1"]
        S1M_I1 --> S1M_D1
        S1M_D1 -- 否 --> S1M_H2{{"Cnt_u32 置 0"}}
        S1M_H2 --> S1M_D2{"Cnt_u32 小于<br>MST_TIME_STAMP_NUM"}
        S1M_D2 -- 是 --> S1M_B2["MstImpl TimeStamp_u32[Cnt_u32] 清 0"]
        S1M_B2 --> S1M_I2["Cnt_u32 加 1"]
        S1M_I2 --> S1M_D2
        S1M_D2 -- 否 --> S1M_A["初始化主核变量<br>测试结果 自检状态 复位信息<br>SafeState 与 TryPwrShdn 标志"]
        S1M_A --> S1M_C1[["CalloutInitStageOneCore0"]]
        subgraph SG_RST1[" "]
            SG_RST1_NOTE["注：仅在 RSTM_PROJ_TYPE_SEL 为 APP_NO_BOOT 时参与编译"]
            SG_RST1_NOTE ~~~ S1M_C2
            S1M_C2[["Gp_RstM_InitOne"]]
        end
        S1M_C1 --> S1M_C2
        S1M_C2 --> S1M_S["StpStage_t 置 STAGE_TWO"]
    end
    D_CORE1 -- 否 --> S1S_P1
    subgraph LANE_S1S[" "]
        direction TB
        S1S_P1["InitRsltAllBits_u32 清 0"] --> S1S_H1{{"Cnt_u32 置 0"}}
        S1S_H1 --> S1S_D1{"Cnt_u32 小于<br>INIT_RSLT_REC_NUM"}
        S1S_D1 -- 是 --> S1S_B1["InitCheckRslt_t[Cnt_u32] 置 E_OK"]
        S1S_B1 --> S1S_I1["Cnt_u32 加 1"]
        S1S_I1 --> S1S_D1
        S1S_D1 -- 否 --> S1S_P2["SatImpl TimeStamp_u32 清 0"]
        S1S_P2 --> S1S_J[" "]
        S1S_J --> S1S_W{"StpStage_t 已到 STAGE_TWO"}
        S1S_W -- 否 --- S1S_J
    end
    style LANE_S1M fill:transparent,stroke:transparent
    style LANE_S1S fill:transparent,stroke:transparent
    style S1S_J fill:transparent,stroke:transparent
    subgraph SG_PRE[" "]
        direction TB
        SG_PRE_NOTE["注：仅在 SAFETY_ENABLE 时参与编译"]
        SG_PRE_NOTE ~~~ S2_C1
        S2_C1[["Gp_TstApp_PreRunInit"]]
        S2_C1 --> S2_C2[["Gp_TstApp_PreRunPhase"]]
    end
    S1M_S --> S2_C1
    S1S_W -- 是 --> S2_C1
    S2_C2 --> S2_TS[["CalloutGetSysTimeMs"]]
    S2_TS --> S2_W[/"记录 PRERUN 时间戳"/]
    S2_W --> D_CORE2{"本核是 Core0 主核"}
    D_CORE2 -- 是 --> S2M_C1
    subgraph LANE_S2M[" "]
        direction TB
        subgraph SG_RST2[" "]
            SG_RST2_NOTE["注：InitTwo 或 Init 由 RSTM_PROJ_TYPE_SEL 条件编译二选一"]
            SG_RST2_NOTE ~~~ S2M_C1
            S2M_C1[["Gp_RstM_InitTwo 或 Gp_RstM_Init"]]
        end
        S2M_C1 --> S2M_C2[["Gp_RstM_GetLastRstTypeInfo<br>取复位原因"]]
        S2M_C2 --> S2M_W[/"复位信息写入 MstImpl"/]
        subgraph SG_ACT[" "]
            direction TB
            SG_ACT_NOTE["注：本分支仅在 SAFETY_ENABLE 且 SAFETY_ACTION_ENABLE 时参与编译"]
            SG_ACT_NOTE ~~~ S2M_D1
            S2M_D1{"TryPwrShdn_b 为 TRUE"}
            S2M_D1 -- 是 --> S2M_PD[["CalloutPwrShdnInStpPhase<br>进入下电 不再返回"]]
            S2M_PD --> END_PD(["下电"])
            S2M_D1 -- 否 --> S2M_D2{"SafeState_b 为 TRUE"}
            S2M_D2 -- 是 --> S2M_SF1[["StpStageTwo_pf<br>Core0 初始化（函数指针）"]]
            S2M_SF1 --> S2M_SF2[["CalloutSbcInitInSafeState"]]
            S2M_SF2 --> S2M_SF3[/"写 SbcInfo_u32"/]
            S2M_SF3 --> S2M_SF4[["CalloutSafeState"]]
            S2M_SF4 --> S2M_S3["StpStage_t 置 STAGE_THREE"]
        end
        S2M_W --> S2M_D1
        subgraph SG_PRE2[" "]
            SG_PRE2_NOTE["注：仅在 SAFETY_ENABLE 时参与编译"]
            SG_PRE2_NOTE ~~~ S2M_N1
            S2M_N1[["Gp_EcuStpShdn_MstProcMcuPreRunTest"]]
        end
        S2M_D2 -- 否 --> S2M_N1
        S2M_N1 --> S2M_N2[["StpStageTwo_pf<br>Core0 初始化（函数指针）"]]
        S2M_N2 --> S2M_N3[["CalloutGetSysTimeMs"]]
        S2M_N3 --> S2M_N4[/"记录 MST_INIT 时间戳"/]
        subgraph SG_POST[" "]
            SG_POST_NOTE["注：仅在 SAFETY_ENABLE 时参与编译"]
            SG_POST_NOTE ~~~ S2M_N5
            S2M_N5[["Gp_EcuStpShdn_MstPostInit"]]
        end
        S2M_N4 --> S2M_N5
        S2M_N5 --> S2M_N6[["CalloutSbcInit"]]
        S2M_N6 --> S2M_N7[/"写 SbcInfo_u32"/]
        S2M_N7 --> S2M_N8[["CalloutGetSysTimeMs"]]
        S2M_N8 --> S2M_N9[/"记录 MST_POST_INIT 时间戳"/]
        S2M_N9 --> S2M_S3
    end
    D_CORE2 -- 否 --> S2S_J
    subgraph LANE_S2S[" "]
        direction TB
        S2S_J[" "]
        S2S_J --> S2S_W{"StpStage_t 已到 STAGE_THREE"}
        S2S_W -- 否 --- S2S_J
    end
    style LANE_S2M fill:transparent,stroke:transparent
    style LANE_S2S fill:transparent,stroke:transparent
    style S2S_J fill:transparent,stroke:transparent
    S2M_S3 --> D_CORE3{"本核是 Core0 主核"}
    S2S_W -- 是 --> D_CORE3
    D_CORE3 -- 是 --> END(["结束"])
    D_CORE3 -- 否 --> S3S_C1
    subgraph LANE_S3S[" "]
        direction TB
        S3S_C1[["StpStageTwo_pf<br>卫星核初始化（函数指针）"]] --> S3S_TS[["CalloutGetSysTimeMs"]]
        S3S_TS --> S3S_W[/"记录卫星初始化完成时间戳"/]
        subgraph SG_S3[" "]
            direction TB
            SG_S3_NOTE["注：本段仅在 SAFETY_ENABLE 时参与编译<br>InitFailedHnd 另需 SAFETY_ACTION_ENABLE"]
            SG_S3_NOTE ~~~ S3S_D1
            S3S_D1{"SafeState_b 为 FALSE"}
            S3S_D1 -- 是 --> S3S_C2[["Gp_EcuStpShdn_CheckInitRslt"]]
            S3S_C2 --> S3S_D2{"InitRsltAllBits_u32 不为 0"}
            S3S_D2 -- 是 --> S3S_C3[["CalloutInitFailedHnd"]]
        end
        S3S_W --> S3S_D1
    end
    style LANE_S3S fill:transparent,stroke:transparent
    S3S_C3 --> END
    S3S_D2 -- 否 --> END
    S3S_D1 -- 否 --> END
    style SG_RST1 ${BOX_STYLE}
    style SG_PRE ${BOX_STYLE}
    style SG_RST2 ${BOX_STYLE}
    style SG_ACT ${BOX_STYLE}
    style SG_PRE2 ${BOX_STYLE}
    style SG_POST ${BOX_STYLE}
    style SG_S3 ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_RST1_NOTE,SG_PRE_NOTE,SG_RST2_NOTE,SG_ACT_NOTE,SG_PRE2_NOTE,SG_POST_NOTE,SG_S3_NOTE condNote`;

FC['Gp_EcuStpShdn_Mainfunction'] = `flowchart TD
    START(["开始"]) --> GETCORE[["CalloutGetCoreId<br>取本核 CoreId"]]
    GETCORE --> D1{"本核是 Core0 主核"}
    D1 -- 是 --> D2{"LAST_SAT_INIT 时间戳为 0<br>（仅取一次）"}
    D2 -- 是 --> C1[["Gp_EcuStpShdn_GetLastSatTimeStamp"]]
    C1 --> W1[/"写 LAST_SAT_INIT 时间戳"/]
    subgraph SG_SAFE[" "]
        direction TB
        SG_SAFE_NOTE["注：本段仅在 SAFETY_ENABLE 时参与编译<br>McuRunTimeTestFailedHnd 另需 SAFETY_ACTION_ENABLE"]
        SG_SAFE_NOTE ~~~ D3
        D3{"TryPwrShdn 与 SafeState 均为 FALSE"}
        D3 -- 是 --> C2[["Gp_TstApp_RunTimePhase<br>MCU 运行时测试"]]
        C2 --> D4{"本核是 Core0 主核"}
        D4 -- 是 --> C3[["CalloutChkMcuRunTimeTest"]]
        C3 --> D5{"运行时测试通过"}
        D5 -- 否 --> C4[["CalloutMcuRunTimeTestFailedHnd"]]
    end
    style SG_SAFE ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_SAFE_NOTE condNote
    D1 -- 否 --> D3
    D2 -- 否 --> D3
    W1 --> D3
    C4 --> END(["结束"])
    D5 -- 是 --> END
    D4 -- 否 --> END
    D3 -- 否 --> END`;

FC['Gp_EcuStpShdn_CheckInitRslt'] = `flowchart TD
    subgraph SG[" "]
        direction TB
        SG_NOTE["注：本函数仅在 SAFETY_ENABLE 时参与编译"]
        SG_NOTE ~~~ START
        START(["开始"]) --> H{{"Cnt_u32 置 0"}}
        H --> D1{"Cnt_u32 小于<br>INIT_RSLT_REC_NUM"}
        D1 -- 是 --> R[/"读 InitCheckRslt_t[Cnt_u32]"/]
        R --> D2{"结果为 E_NOT_OK"}
        D2 -- 是 --> P["InitRsltAllBits_u32<br>对应位 Cnt_u32 置 1"]
        P --> I["Cnt_u32 加 1"]
        I --> D1
        D2 -- 否 --> I
        D1 -- 否 --> END(["结束"])
    end
    style SG ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_NOTE condNote`;

FC['Gp_EcuStpShdn_MstProcMcuPreRunTest'] = `flowchart TD
    subgraph SG[" "]
        direction TB
        SG_NOTE["注：本函数仅在 SAFETY_ENABLE 时参与编译<br>McuPreRunTestFailedHnd 另需 SAFETY_ACTION_ENABLE"]
        SG_NOTE ~~~ START
        START(["开始"]) --> C[["CalloutChkMcuPreRunTest"]]
        C --> D{"PreRun 测试通过"}
        D -- 否 --> W1[/"McuSelfTest_t 置 SELFTEST_FAIL"/]
        W1 --> C2[["CalloutMcuPreRunTestFailedHnd"]]
        C2 --> END(["结束"])
        D -- 是 --> W2[/"McuSelfTest_t 置 SELFTEST_PASS"/]
        W2 --> END
    end
    style SG ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_NOTE condNote`;

FC['Gp_EcuStpShdn_MstPostInit'] = `flowchart TD
    subgraph SG[" "]
        direction TB
        SG_NOTE["注：本函数仅在 SAFETY_ENABLE 时参与编译<br>三个 FailedHnd Callout 另需 SAFETY_ACTION_ENABLE"]
        SG_NOTE ~~~ START
        START(["开始"]) --> C1[["Gp_EcuStpShdn_CheckInitRslt"]]
        C1 --> D1{"InitRsltAllBits_u32 不为 0"}
        D1 -- 是 --> C2[["CalloutInitFailedHnd"]]
        C2 --> C3[["Gp_TstApp_SwitchToRunPhase"]]
        D1 -- 否 --> C3
        C3 --> C4[["CalloutChkSwtToRun"]]
        C4 --> D2{"切换运行阶段成功"}
        D2 -- 否 --> C5[["CalloutSwtToRunFailedHnd"]]
        C5 --> C6[["CalloutChkSbcTest"]]
        D2 -- 是 --> C6
        C6 --> D3{"SBC 自测通过"}
        D3 -- 否 --> W1[/"SbcSelfTest_t 置 SELFTEST_FAIL"/]
        W1 --> C7[["CalloutSbcTestFailedHnd"]]
        C7 --> END(["结束"])
        D3 -- 是 --> W2[/"SbcSelfTest_t 置 SELFTEST_PASS"/]
        W2 --> END
    end
    style SG ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_NOTE condNote`;

FC['Gp_EcuStpShdn_GetLastSatTimeStamp'] = `flowchart TD
    subgraph SG[" "]
        SG_NOTE["注：各核时间戳读取分别在 ACTIVE_CORE_NUM 大于对应核号时参与编译"]
        SG_NOTE ~~~ R1
        R1[/"读各核卫星 TimeStamp_u32 到本地数组"/]
    end
    style SG ${BOX_STYLE}
    ${NOTE_DEF}
    class SG_NOTE condNote
    START(["开始"]) --> R1
    R1 --> H{{"Cnt_u32 与 MaxTimeStamp_u32 置 0"}}
    H --> D1{"Cnt_u32 小于<br>ACTIVE_CORE_NUM"}
    D1 -- 是 --> D2{"MaxTimeStamp_u32 小于<br>TimeStamp_u32[Cnt_u32]"}
    D2 -- 是 --> P["更新 MaxTimeStamp_u32"]
    P --> I["Cnt_u32 加 1"]
    I --> D1
    D2 -- 否 --> I
    D1 -- 否 --> END(["返回 MaxTimeStamp_u32"])`;

const now = new Date().toISOString();
let n = 0;
for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
  const fc = FC[fn.name];
  if (!fc) { console.error('缺少流程图: ' + fn.name); process.exit(1); }
  fn.generated = fn.generated ?? { detailedDescription: '', llmModel: 'claude-sample', generatedAt: now };
  fn.generated.flowchart = fc;
  fn.generated.flowchartFormat = 'mermaid';
  fn.generated.llmModel = 'claude-sample';
  n++;
}
fs.writeFileSync(path, JSON.stringify(model, null, 2), 'utf-8');
console.log(`已注入 ${n} 张流程图`);
