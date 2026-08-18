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
              | 'state' | 'transition' | 'sequence' | 'config' | 'description';
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
  bodyText: string;             // 函数体源码（供 LLM 生成流程图，截断至 8000 字符）
  bodyHash: string;             // sha256（注释剥离+空白归一）
  sigHash: string;              // sha256（签名归一）
  polarion: PolarionMarker;
  generated?: GeneratedFunctionContent;   // LLM 生成内容
}

export interface GeneratedFunctionContent {
  /** 增强后的详细功能描述（LLM 基于注释+调用上下文扩写） */
  detailedDescription: string;
  /** 函数流程图（Mermaid flowchart 源码）；简单顺序函数无此字段 */
  flowchart?: string;
  flowchartFormat?: 'mermaid';
  /** 生成来源与状态，便于评审追溯 */
  llmModel: string;
  generatedAt: string;
}

/** 5.3.1 状态机 */
export interface StateMachineDesign {
  name: string;
  diagram: string;              // mermaid stateDiagram-v2 源码
  diagramFormat: 'mermaid';
  states: { name: string; description: string }[];
  transitions: { from: string; to: string; trigger: string; description: string }[];
  polarion: PolarionMarker;
}

/** 5.3.2 序列图 */
export interface SequenceDesign {
  name: string;                 // 场景名，如 "Initialization"
  diagram: string;              // mermaid sequenceDiagram 源码
  diagramFormat: 'mermaid';
  description: string;
  polarion: PolarionMarker;
}

export interface DynamicDesign {
  stateMachine: StateMachineDesign | null;
  sequences: SequenceDesign[];
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
}
