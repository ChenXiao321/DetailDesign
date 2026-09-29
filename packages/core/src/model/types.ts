/**
 * 中间模型类型定义
 * 对应模板章节结构（G-B035-005 软件详细设计规范（Code））
 * 每个节点带 polarion 标识，标明是否应成为 Polarion 工作项
 */

/** 函数头注释块解析结果（对应模板 5.2.3.2 接口函数表格字段） */
export interface HeaderComment {
  functionName?: string;
  serviceId?: string;
  syncAsync?: string;
  reentrancy?: string;
  paramsIn: ParamDoc[];
  paramsInout: ParamDoc[];
  paramsOut: ParamDoc[];
  returnValue?: string;
  description?: string;
}

export interface ParamDoc {
  raw: string;      // 原始文本，如 "uint8 OsStatus_u8 - OS status"
  name?: string;    // 变量名（能解析出来时）
  type?: string;
  description?: string;
}

export interface Parameter {
  type: string;
  name: string;
  pointerDepth: number;
}

/** Polarion 导入标识 */
export interface PolarionMarker {
  isWorkItem: boolean;          // 是否应生成为独立工作项
  chapter: string;              // 模板章节号，如 "5.2.3.2"
  workItemKind: 'function' | 'variable' | 'type' | 'table' | 'statemachine'
              | 'state' | 'transition' | 'sequence' | 'config' | 'description' | 'diagram';
  title: string;
  workItemId: string | null;    // 导入后回写，如 "Gp_EcuStpShdn-42"
}

export interface FunctionUnit {
  id: string;                   // module::name，稳定标识
  name: string;
  signature: string;            // 归一化签名
  returnType: string;
  parameters: Parameter[];
  isStatic: boolean;
  file: string;
  lineStart: number;
  lineEnd: number;
  comment: HeaderComment | null;
  calls: string[];              // 直接调用的函数名
  calledBy: string[];           // 模块内调用者（分析后回填）
  globalsAccessed: string[];    // 访问的模块级变量名
  conditionalFlags: string[];   // 包裹该函数的条件编译宏，如 GP_ECUSTPSHDN_SAFETY_ENABLE
  innerCondFlags?: string[];    // 函数体内部条件编译段的宏（不含包裹整个函数的外层宏）
  bodyText: string;             // 函数体源码（供 LLM 生成流程图，截断至 8000 字符）
  bodyTextWithPP?: string;      // 含 #if/#endif 指令行的函数体版本（仅体内有条件编译段时填；预处理把 # 行置空格后 LLM 看不到，画虚线框需要指令行定位）
  bodyHash: string;             // sha256（注释剥离+空白归一）
  sigHash: string;              // sha256（签名归一）
  complexity?: number;          // 圈复杂度（判定节点计数法，静态计算；第 7 章评估用）
  infiniteLoop?: boolean;       // 含 while(1)/for(;;) 死循环（第 7 章可控性评估用）
  polarion: PolarionMarker;
  generated?: GeneratedFunctionContent;   // LLM 生成内容
}

export interface GeneratedFunctionContent {
  /** 增强后的详细功能描述（LLM 基于注释+调用上下文扩写） */
  detailedDescription: string;
  /** 函数流程图（Mermaid flowchart 源码）；简单顺序函数无此字段 */
  flowchart?: string;
  flowchartFormat?: 'mermaid';
  /** 流程图渲染 PNG（base64，gen --only images 物化，2x） */
  flowchartPng?: string;
  /** 生成来源与状态，便于评审追溯 */
  llmModel: string;
  generatedAt: string;
}

/** 5.3.1 状态机 */
export interface StateMachineDesign {
  name: string;
  diagram: string;              // mermaid stateDiagram-v2 源码
  diagramFormat: 'mermaid';
  /** 渲染 PNG（base64，gen --only images 物化） */
  diagramPng?: string;
  states: { name: string; description: string }[];
  transitions: { from: string; to: string; trigger: string; description: string }[];
  polarion: PolarionMarker;
}

/** 5.3.2 序列图 */
export interface SequenceDesign {
  name: string;                 // 场景名，如 "Initialization"
  diagram: string;              // mermaid sequenceDiagram 源码
  diagramFormat: 'mermaid';
  /** 渲染 PNG（base64，gen --only images 物化） */
  diagramPng?: string;
  description: string;
  polarion: PolarionMarker;
}

export interface DynamicDesign {
  stateMachine: StateMachineDesign | null;
  /** 多核按角色分图时的完整状态机列表（主核/从核各一张）；仅当 >1 张时写入，stateMachine 恒为第一张（兼容旧读取口径） */
  stateMachines?: StateMachineDesign[];
  sequences: SequenceDesign[];
}

/** 状态机读取统一入口：多核分图产物返回全部角色图，旧单图产物返回单元素列表 */
export function listStateMachines(dd?: DynamicDesign | null): StateMachineDesign[] {
  if (!dd) return [];
  if (dd.stateMachines && dd.stateMachines.length > 0) return dd.stateMachines;
  return dd.stateMachine ? [dd.stateMachine] : [];
}

export interface VariableUnit {
  id: string;
  name: string;
  type: string;
  isStatic: boolean;
  isConst: boolean;
  isVolatile: boolean;
  file: string;
  line: number;
  comment: string | null;       // 变量上方/同行注释
  conditionalFlags: string[];
  polarion: PolarionMarker;
}

export interface TypeUnit {
  id: string;
  name: string;
  kind: 'struct' | 'typedef';
  underlyingType?: string;      // typedef uint8 XxxType → "uint8"
  elements?: { name: string; type: string; comment: string | null }[];  // struct 成员
  relatedDefines?: { name: string; value: string; comment: string | null }[]; // 关联宏（枚举式）
  comment?: string | null;      // 类型上方/行内注释（属性表 Description 用）
  file: string;
  /** LLM 生成内容（5.2.1.2 描述增强；报告优先于源码注释显示） */
  generated?: {
    comment: string;                        // 类型整体用途（属性表 Description 行）
    defines?: Record<string, string>;       // 枚举式 typedef 各关联宏说明（常量表说明列，键=宏名）
    elements?: Record<string, string>;      // struct 各成员说明（元素表说明列，键=成员名）
    llmModel: string;
    generatedAt: string;
  };
  polarion: PolarionMarker;
}

/** 调用的外部接口（5.2.2） */
export interface ExternalInterface {
  name: string;
  signature: string;            // 有声明时（如 Callout），否则仅名字
  group: string;                // 来源分组：文件名或模块前缀（Gp_RstM / Gp_TstApp）
  comment: HeaderComment | null;
  /** 说明来源：header=从头文件注释提取；inferred=按命名/调用上下文推断（报告标"推断，待确认"） */
  commentSource?: 'header' | 'inferred';
  calledFrom: string[];         // 模块内哪些函数调它
  generated?: GeneratedFunctionContent;   // LLM 生成内容（Callout 的主要功能描述用 detailedDescription）
  polarion: PolarionMarker;     // 表格类工作项标记
}

export interface ConfigUsage {
  kind: 'condCompile' | 'arrayDim' | 'loopBound' | 'call' | 'reference';
  file: string;
  line: number;               // 1-based 行号
  context: string;            // 该行内容（截断至 ~80 字符）
}

export interface ConfigMacro {
  name: string;
  value: string;
  isFunctionLike: boolean;      // 带参数的宏，如 NOP()
  comment: string | null;
  file: string;
  /** 分类：值（去括号）为 STD_ON/STD_OFF 的特性开关 → functional（6.2）；
   * 无参函数式宏且取值仅为另一宏调用（如 NOP → MCAL_NOP()）→ alias（实现别名，非配置项）；
   * 其余 → general（6.1） */
  kind: 'general' | 'functional' | 'alias';
  usages: ConfigUsage[];        // 模块内引用点（静态扫描）
  affects: string[];            // conditionalFlags 含本宏的函数/变量/类型名（回填）
  generated?: {
    valueEffect: string;        // 取值影响说明（LLM 生成）
    llmModel: string;
    generatedAt: string;
  };
  polarion: PolarionMarker;
}

/** 报告骨架内容（1/2/3/7/8 章正文与各章引导句，gen 期物化进 design json）；
 *  物化后 report/audit 纯渲染只读 json，不再现读外部缩写表/配置。
 *  边界：章节标题/表头/角标等纯版式文字不下沉；派生数据（圈复杂度明细表）源数据已在 json，渲染期计算。 */
export interface DocumentContent {
  purpose: string;                          // 1 目的（最终文本）
  scope: string;                            // 2 适用范围（最终文本）
  fileTable?: [string, string][];           // 4.1 文件说明表（文件基名, 说明），已按报告顺序排序（0929 起物化；存量物化 json 缺省时渲染期现算补齐）
  importedTypes?: [string, string[]][];     // 5.2.1.1 引用的数据类型表（模块名, 类型名单），已按报告顺序排序（0929 起物化；缺省时渲染期现算补齐）
  abbreviations: [string, string][];        // 3.1 最终表行（合并模式按出现过滤 / replace 模式全量）
  abbreviationNote: string;                 // 3.1 表下注释
  definitions: [string, string][];          // 3.2 最终表行
  definitionNote: string | null;            // 3.2 表下注释（无外部定义表时为 null）
  abbreviationGaps: string[];               // 缺口名单（replace 模式正文出现但表内未定义；空=无缺口/非 replace）
  evaluationRows: { dim: string; no: number; content: string; fact: string }[]; // 7 章 14 行（fact=最终 HTML 片段）
  complexityNote: string;                   // 圈复杂度明细表上方注释
  evaluationSummary: string[];              // 7 章总结列表（最终 HTML 片段）
  supportFiles: [string, string, string][]; // 8 章表（序号/文档名称/文档编号）
  supportNote: string;                      // 8 章表下注释
  /** 各章引导句/说明句（最终文本，键=章节位）：
   *  overview=功能接口总图引导句 callGraph=内部函数调用图引导句 include=4.2 包含关系注
   *  providedVarsEmpty=5.2.3.1 空注 externalVars=5.2.2.1 注 externalFnsCallout=5.2.2.2 Callout 注
   *  internalVars=5.2.4.1 注 configGeneral=6.1 引导句 configFunctional=6.2 引导句
   *  calloutCfg=6.2 Callout function 引导句 evalSummaryIntro=7 章总结引导句 */
  notes: Record<string, string>;
  /** 4.2 包含关系图渲染 PNG（base64，gen --only images 物化；图 mermaid 源码渲染期由 files[].includes 派生） */
  includeGraphPng?: string;
}

export interface ModuleModel {
  module: string;               // FC 名，如 Gp_EcuStpShdn
  analyzedAt: string;           // ISO 时间戳
  functionalDescription?: string; // 5.1 功能描述（LLM 生成后填入）
  files: {
    path: string;
    role: 'source' | 'header' | 'types' | 'config' | 'callout' | 'memmap';
    includes?: string[];        // 该文件 #include 的头文件名（4.2 文件包含关系）
  }[];
  providedFunctions: FunctionUnit[];    // 5.2.3.2
  internalFunctions: FunctionUnit[];    // 5.2.4.2
  internalVariables: VariableUnit[];    // 5.2.4.1
  providedVariables: VariableUnit[];    // 5.2.3.1
  calledExternalFunctions: ExternalInterface[]; // 5.2.2.2
  types: TypeUnit[];                    // 5.2.1.2
  configMacros: ConfigMacro[];          // 6
  dynamicDesign?: DynamicDesign;        // 5.3（LLM 生成后填入）
  /** 5.1 功能接口总图（分析时静态生成，工作项，随模型进 diff/同步） */
  interfaceOverview?: { diagram: string; diagramFormat: 'mermaid'; polarion: PolarionMarker;
    /** 渲染 PNG（base64，gen --only images 物化） */ diagramPng?: string };
  /** 5.1 内部函数调用图（分析时静态生成；按对外接口函数逐张拆分，每张一个工作项） */
  callGraphs?: { name: string; diagram: string; diagramFormat: 'mermaid'; polarion: PolarionMarker;
    /** 渲染 PNG（base64，gen --only images 物化） */ diagramPng?: string }[];
  /** 报告骨架内容（gen --only document 物化；缺省时 report/audit 渲染期现算，产物一致） */
  document?: DocumentContent;
}
