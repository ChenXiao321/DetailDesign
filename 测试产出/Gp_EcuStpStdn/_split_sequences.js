// 序列图按主核/从核拆分：samples 源与 lld_design.json 同步更新（dynamicDesign.sequences 2→4）
// 内容依据 Startup/Mainfunction 流程图（代码事实）核对：
//   阶段一 从核：InitCheckRslt/SatImpl 时间戳清 0 → 自旋 STAGE_TWO；主核：缓冲区初始化 → InitStageOneCore0 → 置 STAGE_TWO
//   阶段二 共同：PreRunInit/PreRunPhase（SAFETY_ENABLE）→ GetSysTimeMs → 记录 PRERUN 时间戳；之后主核走 RstM/分支/置 STAGE_THREE，从核自旋 STAGE_THREE
//   阶段三 从核：StpStageTwo_pf satellite 初始化 → GetSysTimeMs → 记录完成时间戳 → 非安全状态且失败 → CheckInitRslt/InitFailedHnd
//   Mainfunction 主核：首次 GetLastSatTimeStamp；RunTimePhase 后 ChkMcuRunTimeTest/FailedHnd；从核仅 RunTimePhase
const fs = require('fs');

const SEQ = [
  {
    name: 'Initialization（主核 Core0）',
    description: 'Gp_EcuStpShdn_Startup 初始化序列（主核 Core0）：三阶段启动过程中主核侧的交互顺序',
    diagram: `sequenceDiagram
    actor EcuM
    participant M as Gp_EcuStpShdn_Startup(Core0)
    participant CO as Callout
    participant TA as Gp_TstApp
    participant RM as Gp_RstM
    EcuM->>M: Startup()
    M->>CO: CalloutGetCoreId()
    Note over M: Stage One 主核
    M->>M: 初始化主核运行时缓冲区
    M->>CO: CalloutInitStageOneCore0(SatImpl)
    M->>RM: InitOne() 仅限 APP_NO_BOOT 配置
    M->>M: StpStage_t 置为 STAGE_TWO
    Note right of M: 解除 satellite 阶段一自旋等待
    Note over M: Stage Two 主核
    M->>TA: PreRunInit() 和 PreRunPhase()
    Note right of M: 仅 SAFETY_ENABLE 时参与编译
    M->>CO: CalloutGetSysTimeMs()
    M->>M: 记录 PRERUN 完成时间戳
    M->>RM: Init() 或 InitTwo()
    M->>RM: GetLastRstTypeInfo()
    alt TryPwrShdn_b 为 TRUE
        M->>CO: CalloutPwrShdnInStpPhase()
        Note right of M: 程序不再返回
    else SafeState_b 为 TRUE
        M->>CO: StpStageTwo_pf(SatImpl) core0初始化
        M->>CO: CalloutSbcInitInSafeState(SbcInfo)
        M->>CO: CalloutSafeState()
    else 正常路径
        M->>M: MstProcMcuPreRunTest()
        M->>CO: StpStageTwo_pf(SatImpl) core0初始化
        M->>M: MstPostInit()
        M->>CO: CalloutSbcInit(SbcInfo)
    end
    M->>M: StpStage_t 置为 STAGE_THREE
    Note right of M: 解除 satellite 阶段二自旋等待`,
    title: 'Gp_EcuStpShdn Initialization 序列图（主核 Core0）',
  },
  {
    name: 'Initialization（从核 satellite）',
    description: 'Gp_EcuStpShdn_Startup 初始化序列（从核 satellite）：三阶段启动过程中从核侧的交互顺序，自旋等待与 master 屏障同步',
    diagram: `sequenceDiagram
    actor EcuM
    participant S as Gp_EcuStpShdn_Startup(satellite)
    participant CO as Callout
    participant TA as Gp_TstApp
    EcuM->>S: Startup()
    S->>CO: CalloutGetCoreId()
    Note over S: Stage One 从核
    S->>S: InitCheckRslt 与 SatImpl 时间戳清 0
    S->>S: 自旋等待 STAGE_TWO
    Note right of S: 等待 master 完成阶段一并置位
    Note over S: Stage Two 从核
    S->>TA: PreRunInit() 和 PreRunPhase()
    Note right of S: 仅 SAFETY_ENABLE 时参与编译
    S->>CO: CalloutGetSysTimeMs()
    S->>S: 记录 PRERUN 完成时间戳
    S->>S: 自旋等待 STAGE_THREE
    Note right of S: 等待 master 完成阶段二并置位
    Note over S: Stage Three 从核
    S->>CO: StpStageTwo_pf(SatImpl) satellite初始化
    S->>CO: CalloutGetSysTimeMs()
    S->>S: 记录初始化完成时间戳
    alt SafeState_b 为 FALSE 且初始化失败
        S->>S: CheckInitRslt()
        S->>CO: CalloutInitFailedHnd(InitRsltAllBits)
    end`,
    title: 'Gp_EcuStpShdn Initialization 序列图（从核 satellite）',
  },
  {
    name: 'Runtime（主核 Core0）',
    description: 'Gp_EcuStpShdn_Mainfunction 周期运行序列（主核 Core0）：含最后 satellite 初始化时间戳记录与 MCU 运行时测试结果检查',
    diagram: `sequenceDiagram
    actor OS
    participant MF as Gp_EcuStpShdn_Mainfunction(Core0)
    participant CO as Callout
    participant TA as Gp_TstApp
    OS->>MF: Mainfunction() 周期调度
    MF->>CO: CalloutGetCoreId()
    alt LAST_SAT_INIT 时间戳为 0（仅取一次）
        MF->>MF: GetLastSatTimeStamp()
        Note right of MF: 记录最后 satellite 初始化时间戳
    end
    alt TryPwrShdn 与 SafeState 均为 FALSE
        MF->>TA: RunTimePhase()
        MF->>CO: CalloutChkMcuRunTimeTest()
        alt 运行时测试失败
            MF->>CO: CalloutMcuRunTimeTestFailedHnd()
        end
    else 安全状态或尝试下电
        Note right of MF: 跳过 MCU 运行时测试
    end`,
    title: 'Gp_EcuStpShdn Runtime 序列图（主核 Core0）',
  },
  {
    name: 'Runtime（从核 satellite）',
    description: 'Gp_EcuStpShdn_Mainfunction 周期运行序列（从核 satellite）：仅执行 MCU 运行时测试',
    diagram: `sequenceDiagram
    actor OS
    participant MF as Gp_EcuStpShdn_Mainfunction(satellite)
    participant CO as Callout
    participant TA as Gp_TstApp
    OS->>MF: Mainfunction() 周期调度
    MF->>CO: CalloutGetCoreId()
    alt TryPwrShdn 与 SafeState 均为 FALSE
        MF->>TA: RunTimePhase()
    else 安全状态或尝试下电
        Note right of MF: 跳过 MCU 运行时测试
    end`,
    title: 'Gp_EcuStpShdn Runtime 序列图（从核 satellite）',
  },
];

const toSeq = (s) => ({
  name: s.name,
  description: s.description,
  diagram: s.diagram,
  diagramFormat: 'mermaid',
  polarion: {
    isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence',
    title: s.title, workItemId: null,
  },
});

// 1) samples 源
const sp = 'samples/claude_generated_content.json';
const sj = JSON.parse(fs.readFileSync(sp, 'utf-8'));
sj.dynamicDesign.sequences = SEQ.map(toSeq);
fs.writeFileSync(sp, JSON.stringify(sj, null, 2), 'utf-8');

// 2) lld_design.json（samples 合并产物的等价结果）
const dp = '测试产出/Gp_EcuStpStdn/lld_design.json';
const dj = JSON.parse(fs.readFileSync(dp, 'utf-8'));
dj.dynamicDesign.sequences = SEQ.map(toSeq);
fs.writeFileSync(dp, JSON.stringify(dj, null, 2), 'utf-8');

console.log('sequences now:', sj.dynamicDesign.sequences.map(s => s.name).join(' | '));
