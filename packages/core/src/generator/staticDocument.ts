/**
 * 报告骨架内容物化（1/2/3/7/8 章正文与各章引导句，零 LLM 确定性生成）。
 * 逻辑自 htmlReport.ts 搬入：gen 期物化进 design json（model.document），
 * report/audit 纯渲染只读 json；存量 json 无 document 时由 htmlReport 渲染期
 * 调用同一函数现算——单一实现保证两条路径产物逐字节一致。
 */
import type { ModuleModel, DocumentContent } from '../model/types.js';
import { listStateMachines } from '../model/types.js';
import { esc } from '../report/cards.js';

/** 外部缩写表输入（CLI resolveAbbreviations 的结果原样透传；core 不碰 fs） */
export interface AbbrTableInput {
  entries: [string, string][];
  definitions: [string, string][];
  /** true = 外部缩写表模式：3.1/3.2 以 entries/definitions 为唯一来源（内置词典不兜底）、全量收录 */
  replace: boolean;
  /** 外部表来源文件名（3.1 注释行展示） */
  source?: string;
}

/** 候选缩写词典（合并模式按文档实际出现过滤；replace 模式不兜底） */
const ABBR_CANDIDATES: [string, string][] = [
  ['ABIST', 'Analog Built-In Self Test 模拟内建自测试'],
  ['ADC', 'Analog to Digital Converter 模数转换器'],
  ['ASIL', 'Automotive Safety Integrity Level 汽车安全完整性等级'],
  ['ASW', 'Application Software 应用软件'],
  ['AUTOSAR', 'AUTomotive Open System ARchitecture 汽车开放系统架构'],
  ['BIST', 'Built-In Self Test 内建自测试'],
  ['DEM', 'Diagnostic Event Manager 诊断事件管理模块（AUTOSAR）'],
  ['DET', 'Default Error Tracer 默认错误追踪模块（AUTOSAR）'],
  ['ECU', 'Electronic Control Unit 电子控制单元'],
  ['EcuM', 'ECU State Manager ECU 状态管理模块'],
  ['ENA', 'Enable 使能信号（TLF35584 唤醒源之一）'],
  ['ERR', 'Error 错误指示信号（TLF35584 安全路径）'],
  ['FC', 'Function Cluster 功能簇'],
  ['FWD', 'Functional Watchdog 功能看门狗'],
  ['LLD', 'Low Level Design 详细设计'],
  ['MCAL', 'Microcontroller Abstraction Layer 微控制器抽象层'],
  ['MCU', 'Microcontroller Unit 微控制器'],
  ['OS', 'Operating System 操作系统'],
  ['PORST', 'Power-On Reset 上电复位'],
  ['ROT', 'Reset Output 复位输出信号（TLF35584）'],
  ['RTE', 'Runtime Environment 运行时环境'],
  ['SBC', 'System Basis Chip 系统基础芯片'],
  ['SPI', 'Serial Peripheral Interface 串行外设接口'],
  ['SSC', 'Safe State Control 安全状态控制（TLF35584）'],
  ['WAK', 'Wake-up 唤醒信号（TLF35584 唤醒源之一）'],
  ['Wdg', 'Watchdog 看门狗'],
  ['WDI', 'Watchdog Input 看门狗输入信号（TLF35584）'],
  ['WWD', 'Window Watchdog 窗口看门狗'],
];

/** 文档全文本扫描面（缩写出现过滤/缺口检测/Callout 术语判定共用） */
function allDocumentText(model: ModuleModel): string {
  const allFns = [...model.providedFunctions, ...model.internalFunctions];
  return [
    model.module,
    ...allFns.map(f => `${f.name} ${f.signature} ${f.generated?.detailedDescription ?? ''}`),
    ...model.calledExternalFunctions.map(e => `${e.name} ${e.generated?.detailedDescription ?? ''}`),
    ...model.configMacros.map(c => `${c.name} ${c.generated?.valueEffect ?? ''}`),
    ...model.types.map(t => `${t.name} ${t.comment} ${t.generated?.comment ?? ''}`),
    model.functionalDescription ?? '',
    // 序列图/状态机图源也属文档内容（含 actor OS 等角色名）
    ...listStateMachines(model.dynamicDesign).map(sm => sm.diagram),
    ...(model.dynamicDesign?.sequences ?? []).map(s => `${s.name} ${s.diagram} ${s.description}`),
  ].join(' ');
}

/** 4.2 包含关系注的外部头文件名单（与 htmlReport 建图逻辑同口径） */
function droppedExternalIncludes(model: ModuleModel): string[] {
  const moduleFileBases = new Set(model.files.map(f => f.path.split(/[\\/]/).pop()!));
  const dropped = new Set<string>();
  for (const f of model.files) {
    for (const inc of f.includes ?? []) {
      const incBase = inc.split(/[\\/]/).pop()!;
      if (/memmap/i.test(incBase)) continue;   // MemMap.h 默认被各文件包含，不画出
      if (!moduleFileBases.has(incBase) && incBase !== 'Std_Types.h') dropped.add(incBase);
    }
  }
  return [...dropped].sort();
}

/** 文件用途说明（4.1 文件说明表）：按角色 + 分析数据生成中文描述（自 htmlReport 搬入，物化进 document.fileTable） */
function describeFile(path: string, role: string, model: ModuleModel): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const isC = /\.c$/i.test(base);
  switch (role) {
    case 'source': {
      // 主要入口：按命名约定识别 Startup/Mainfunction/Init 类入口函数
      const entries = model.providedFunctions
        .filter(f => /_(Startup|Mainfunction|MainFunction|Init)$/.test(f.name))
        .map(f => f.name.replace(/^Gp_\w+?_(?=[A-Z])/, ''));
      const entryNote = entries.length > 0 ? `；主要入口为 ${entries.join('、')}` : '';
      return `模块主实现文件：实现 ${model.providedFunctions.length} 个对外接口函数与 ${model.internalFunctions.length} 个内部函数${entryNote}`;
    }
    case 'header':
      return `模块对外头文件：声明 ${model.providedFunctions.length} 个对外接口函数`;
    case 'types': {
      const td = model.types.filter(t => t.kind === 'typedef').length;
      const st = model.types.filter(t => t.kind === 'struct').length;
      return `类型定义头文件：定义 ${td} 个枚举式 typedef 与 ${st} 个结构体`;
    }
    case 'callout': {
      const n = model.calledExternalFunctions.filter(e => e.group === 'Callout').length;
      return isC
        ? `Callout 实现文件（配置代码）：由集成方实现 ${n} 个 Callout 函数的具体策略`
        : `Callout 声明头文件（配置代码）：声明 ${n} 个由集成方实现的 Callout 函数`;
    }
    case 'config': {
      if (isC) return '配置数据文件（配置代码）：定义模块配置数据（核运行时容器、函数指针表等）';
      const n = model.configMacros.filter(c => c.file === path && c.kind !== 'alias').length;
      return n > 0
        ? `配置参数头文件（配置代码）：定义 ${n} 个配置宏`
        : '配置数据头文件（配置代码）：配置数据的类型与声明';
    }
    case 'memmap':
      return '内存映射头文件：定义变量/函数的存储段放置（MemMap），不影响功能逻辑';
    default:
      return role;
  }
}

/** 4.1 表格顺序：主文件在前，其后按 头文件→类型→配置→Callout→Memmap */
function fileSortKey(f: { path: string; role: string }): string {
  const rank: Record<string, number> = { source: 0, header: 1, types: 2, config: 3, callout: 4, memmap: 5 };
  const isC = /\.c$/i.test(f.path) ? '1' : '0';  // 同角色 .h 在 .c 前
  return `${rank[f.role] ?? 9}${isC}${f.path}`;
}

/** 5.2.1.1 引用的数据类型表（自 htmlReport 搬入，物化进 document.importedTypes）；
 *  只列类型，对应模板 模块名|Imported Type；外部函数归属 5.2.2，不在此列 */
function buildImportedTypes(model: ModuleModel): [string, string[]][] {
  const STD_TYPES = ['Std_ReturnType', 'boolean', 'uint8', 'uint16', 'uint32', 'uint64',
    'sint8', 'sint16', 'sint32', 'sint64', 'float32', 'float64'];
  const scanText = [
    ...[...model.providedFunctions, ...model.internalFunctions].map(f => f.signature),
    ...[...model.internalVariables, ...model.providedVariables].map(v => v.type),
    ...model.types.flatMap(t => [t.underlyingType ?? '', ...(t.elements ?? []).map(e => e.type)]),
  ].join(' ');
  const usedStdTypes = STD_TYPES.filter(t => new RegExp(`\\b${t}\\b`).test(scanText));
  // 外部类型探测：按 AUTOSAR 命名约定取 XxxType 形标识符，排除本模块已定义类型、Std_Types 与已知函数名
  //（TLF 有函数 Gp_TLF35584_GetResetType 以 Type 结尾会被误当类型）。
  // 模块名归组：标准 AUTOSAR 前缀取首段（Dem_EventIdType → Dem）；项目根前缀（module 首段，如 Gp）下的
  // 名字取「去 Type 后缀后的前两段」（Gp_TimeCalType → Gp_TimeCal）——首段 Gp 是产品族前缀而非模块名；
  // 无下划线前缀的（如 CounterType）归入「其他」
  const localTypeNames = new Set(model.types.map(t => t.name));
  const knownFnNames = new Set(
    [...model.providedFunctions, ...model.internalFunctions, ...model.calledExternalFunctions]
      .map(f => f.name),
  );
  const rootPrefix = model.module.split('_')[0];
  const extTypeGroups = new Map<string, Set<string>>();
  for (const tok of scanText.match(/[A-Za-z_]\w*/g) ?? []) {
    if (!/Type$/.test(tok)) continue;
    if (localTypeNames.has(tok) || STD_TYPES.includes(tok) || knownFnNames.has(tok)) continue;
    const stripped = tok.replace(/Type$/, '');
    const mod = tok.startsWith(`${rootPrefix}_`) && stripped.includes('_')
      ? stripped.split('_').slice(0, 2).join('_')
      : tok.includes('_') ? tok.split('_')[0] : '其他';
    if (!extTypeGroups.has(mod)) extTypeGroups.set(mod, new Set());
    extTypeGroups.get(mod)!.add(tok);
  }
  const rows: [string, string[]][] = [];
  if (usedStdTypes.length > 0) rows.push(['Std_Types', usedStdTypes]);
  for (const [mod, types] of [...extTypeGroups.entries()].sort()) {
    rows.push([mod, [...types]]);
  }
  return rows;
}

/** 物化报告骨架内容。abbr 缺省 = 纯内置词典合并模式（无 config 时的现行行为） */
export function buildDocumentContent(model: ModuleModel, abbr?: AbbrTableInput): DocumentContent {
  const allFns = [...model.providedFunctions, ...model.internalFunctions];
  const callouts = model.calledExternalFunctions.filter(e => e.group === 'Callout');
  const calloutCount = callouts.length;
  const functionalCfgs = model.configMacros.filter(c => c.kind === 'functional');
  const calloutSecNo = `6.2.${functionalCfgs.length + 1}`;
  const allText = allDocumentText(model);

  // ---- 3.1 缩写表 ----
  // 用户配置词条优先（同名覆盖内置），其余内置词条照常参与出现过滤；
  // 外部缩写表模式（replace）则内置词典不兜底，3.1 以外部词条为唯一来源
  const userAbbr = abbr?.entries ?? [];
  const userKeys = new Set(userAbbr.map(([a]) => a.toUpperCase()));
  const replaceMode = abbr?.replace === true;
  const abbrDict = replaceMode
    ? userAbbr
    : [...userAbbr, ...ABBR_CANDIDATES.filter(([a]) => !userKeys.has(a.toUpperCase()))];
  const abbreviations = replaceMode
    // 外部表模式：全量收录外部表条目（与 Word 表一致），不再按模块出现过滤
    ? abbrDict
    : abbrDict.filter(([a]) => new RegExp(`\\b${a}\\b`, 'i').test(allText));
  const abbreviationNote = replaceMode
    ? `注：本表定义由外部缩写表（${esc(abbr?.source ?? '外部文档')}）提供，全量收录表中条目；新增/修订缩写请联系缩写表维护方，临时补充可写入 lld.config.json 的 abbreviations 节。`
    : '注：仅列出本模块文档/代码中实际出现的缩写，可按项目需要补充。';

  // ---- 缺口检测（replace 模式）：正文出现的全大写词（2+ 字符、非十六进制、非停用词）表内无定义 ----
  const abbreviationGaps: string[] = [];
  if (replaceMode) {
    // 流程图节点/代码层常见非缩写词；名单是提示性的，宁多勿漏由用户甄别
    const STOP = new Set(['STD', 'ON', 'OFF', 'OK', 'TRUE', 'FALSE', 'NULL', 'VOID',
      'START', 'END', 'NOTE', 'TODO', 'NA', 'ID', 'IF', 'IN', 'OUT']);
    const text = allText.replace(/0x[0-9A-Fa-f]+/g, ' ');
    // 状态机的状态名（UNDEF/ONE/TWO…）是图内标识符不是缩写，不报缺口
    const stateNames = new Set<string>();
    for (const sm of listStateMachines(model.dynamicDesign)) {
      for (const m of sm.diagram.matchAll(/\b([A-Z][A-Z0-9]{1,11})\b/g)) stateNames.add(m[1]!);
    }
    const gaps = new Map<string, number>();
    for (const m of text.matchAll(/\b[A-Z][A-Z0-9]{1,11}\b/g)) {
      const t = m[0];
      if (STOP.has(t) || userKeys.has(t) || stateNames.has(t)) continue;
      gaps.set(t, (gaps.get(t) ?? 0) + 1);
    }
    abbreviationGaps.push(...[...gaps.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 50));
  }

  // ---- 3.2 定义表 ----
  // 术语定义：Callout 是术语而非缩写，归 3.2；与缩写同样按文档实际出现过滤（无 Callout 的模块不列）
  const DEF_ROWS: [string, string][] = [
    ['可重入性', '函数在同时多次调用，例如操作系统在进程调度过程中，或者单片机、处理器等中断的时候会发生重入的现象。（可重入函数可以在任意时刻被打断，稍后再继续运行，不会丢失数据；不可重入函数不能由超过一个任务共享，除非能确保函数的互斥）'],
    ['静态全局变量', 'static 声明的文件作用域变量（内部链接），仅本模块内可见，外部模块不可直接访问；本报告 5.2.4.1 节列出。'],
  ];
  if (/\bCallout\b/.test(allText)) {
    DEF_ROWS.unshift(['Callout', 'Callout 函数：由集成方在配置代码中实现，模块通过调用 Callout 适配项目策略']);
  }
  // 外部表模式：docx「定义」表条目全量列入 3.2（与 Word 表一致），内置通用行随后
  const extDefs = replaceMode ? (abbr?.definitions ?? []) : [];
  const definitions: [string, string][] = [...extDefs, ...DEF_ROWS];
  const definitionNote = extDefs.length > 0
    ? `注：术语定义由外部缩写表（${esc(abbr?.source ?? '外部文档')}）「定义」节提供，全量收录表中条目。`
    : null;

  // ---- 7 详细设计规范评估（模板固定 14 项；事实依据自动填，结论人工确认） ----
  const extGroupNames = [...new Set(model.calledExternalFunctions.map(e => e.group))];
  const nonCalloutGroups = extGroupNames.filter(g => g !== 'Callout');
  const commIfs = model.calledExternalFunctions.filter(e =>
    /\b(Spi|Can(Fd)?|Lin|Eth|Com_|PduR|Dcm|SoAd|Fr)(_|$|\b)/i.test(e.name));
  const maxComplexity = Math.max(0, ...allFns.map(f => f.complexity ?? 0));
  const highComplexity = allFns.filter(f => (f.complexity ?? 0) > 10);
  const loopFns = allFns.filter(f => f.infiniteLoop);
  const condCfgs = model.configMacros.filter(c => c.usages.some(u => u.kind === 'condCompile'));
  const safetyIds = [
    ...allFns.filter(f => /safe|safety/i.test(f.name)).map(f => f.name),
    ...model.configMacros.filter(c => /safe|safety/i.test(c.name)).map(c => c.name),
  ];
  const sms = listStateMachines(model.dynamicDesign);
  // 迁移表合并口径：多角色分图时合并各角色迁移并按 从|到|触发 去重（与 5.3.1.2 表一致）
  const mergedTransitions = [...new Map(sms.flatMap(sm => sm.transitions).map(t => [`${t.from}|${t.to}|${t.trigger}`, t])).values()];
  const TODO_CONCLUSION = '<span class="todo">结论待人工确认</span>';
  const evaluationRows = [
    { dim: '互操作性/交互', no: 1, content: '对软件单元的接口一致性进行分析',
      fact: `本模块提供 ${model.providedFunctions.length} 个接口函数（5.2.3.2），调用外部接口 ${model.calledExternalFunctions.length} 个（${extGroupNames.join('、')}），签名与调用点均已由静态分析提取；与软件架构接口的一致性需对照架构文档确认。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 2, content: '软件单元对全局变量引用的正确性',
      fact: `模块内静态全局变量 ${model.internalVariables.length} 个（5.2.4.1），外部链接全局变量 ${model.providedVariables.length} 个（5.2.3.1）；各函数的全局变量访问已在函数卡片逐条列出。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 3, content: '对涉及通讯协议的软件单元分析协议的一致性',
      fact: commIfs.length === 0
        ? '静态分析未探测到通讯协议相关接口（Spi/Can/Lin/Eth/Com/PduR 等）调用，本模块不涉及通讯协议。<span class="muted">（自动判定，如有遗漏请人工更正）</span>'
        : `探测到通讯协议相关调用：${commIfs.map(e => `<code>${esc(e.name)}</code>`).join('、')}。${TODO_CONCLUSION}` },
    { dim: '互操作性/交互', no: 4, content: '分析软件单元是否能够体现动态行为和交互',
      fact: model.dynamicDesign
        ? `5.3 已生成${sms.length > 0 ? `状态机「${sms.map(sm => esc(sm.name)).join('」与「')}」（${sms[0].states.length} 状态 / ${mergedTransitions.length} 迁移）` : ''}${model.dynamicDesign.sequences.length > 0 ? `与 ${model.dynamicDesign.sequences.length} 张序列图` : ''}；5.1 功能接口总图与各函数调用图体现交互关系。${TODO_CONCLUSION}`
        : `5.3 动态设计（状态机/序列图）尚未生成；5.1 已提供功能接口总图与内部函数调用图。${TODO_CONCLUSION}` },
    { dim: '关键性', no: 5, content: '分析与其他单元/组件的依赖关系',
      fact: `外部依赖模块：${nonCalloutGroups.length > 0 ? nonCalloutGroups.join('、') : '无'}（接口明细见 5.2.2）；Callout 函数 ${calloutCount} 个由集成方在配置代码中实现（见 6.2）。${TODO_CONCLUSION}` },
    { dim: '关键性', no: 6, content: '其他关键性的分析维度(如任务、算法等)',
      fact: condCfgs.length > 0
        ? `条件编译配置项 ${condCfgs.length} 个（${condCfgs.map(c => `<code>${esc(c.name)}</code>`).join('、')}）直接裁剪参与编译的函数/变量（影响范围见第 6 章）。${TODO_CONCLUSION}`
        : `本模块无条件编译裁剪点。${TODO_CONCLUSION}` },
    { dim: '技术复杂性', no: 7, content: '分析详细设计单元的复杂度（模型复杂度、圈复杂度）',
      fact: `已静态计算全部 ${allFns.length} 个函数的圈复杂度（明细见下表）：最大 ${maxComplexity}${highComplexity.length > 0 ? `，超过 10 的函数 ${highComplexity.length} 个（${highComplexity.map(f => `<code>${esc(f.name)}</code>`).join('、')}）` : '，无超过 10 的函数'}。${TODO_CONCLUSION}` },
    { dim: '可实现性', no: 8, content: '从时间周期、实现条件（人员、设备等）下分析相应功能的实现能力，分析出风险、并制定处理措施',
      fact: `（项目管理层面的评估，无代码事实可自动提取）${TODO_CONCLUSION}` },
    { dim: '可测试性', no: 9, content: '分析软件单元的可控性（是否存在死循环、复杂度过高的情况）',
      fact: `死循环（while(1)/for(;;)）探测：${loopFns.length === 0 ? '未发现' : `发现 ${loopFns.length} 处（${loopFns.map(f => `<code>${esc(f.name)}</code>`).join('、')}）`}；圈复杂度最大 ${maxComplexity}${highComplexity.length > 0 ? `，${highComplexity.length} 个函数超过 10` : ''}。${TODO_CONCLUSION}` },
    { dim: '可测试性', no: 10, content: '分析单元输入、输出的可观测性',
      fact: `全部 ${allFns.length} 个函数的输入/输出参数与返回值已在 5.2.3.2 / 5.2.4.2 函数卡片中逐项列出（含取值范围说明）。${TODO_CONCLUSION}` },
    { dim: '可复用性', no: 11, content: '分析详细设计单元是否能够被本系统或其他系统使用的可能性',
      fact: `本模块含 ${calloutCount} 个 Callout 项目适配点与 ${model.configMacros.filter(c => c.kind !== 'alias').length} 个配置宏，平台化/复用策略需人工评估。${TODO_CONCLUSION}` },
    { dim: '安全性', no: 12, content: '分析软件设计单元是否是功能安全输出',
      fact: safetyIds.length > 0
        ? `探测到安全相关标识符：${safetyIds.map(s => `<code>${esc(s)}</code>`).join('、')}；是否构成功能安全输出需人工判定。${TODO_CONCLUSION}`
        : `未探测到安全相关标识符。${TODO_CONCLUSION}` },
    { dim: '安全性', no: 13, content: '分析违反功能安全目标的风险可控性',
      fact: `（需结合系统级安全分析人工评估）${TODO_CONCLUSION}` },
    { dim: '安全性', no: 14, content: '分析是否违背功能安全',
      fact: `（需结合系统级安全分析人工评估）${TODO_CONCLUSION}` },
  ];
  const complexityNote = '判定节点计数法：1 + if / for / while / case / &amp;&amp; / || / ?: 数量。阈值 10 为常见评审参考值，最终以项目规范为准。';
  const evaluationSummary = [
    `互操作性/交互：接口与全局变量的定义、调用关系详见 5.2；通讯协议${commIfs.length === 0 ? '不涉及' : '一致性待确认'}。<span class="todo">待人工确认</span>`,
    `关键性：外部依赖（${nonCalloutGroups.join('、') || '无'}）与任务调度考虑。<span class="todo">待人工确认</span>`,
    `技术复杂性：圈复杂度最大 ${maxComplexity}${highComplexity.length > 0 ? `，${highComplexity.length} 个函数超过 10` : '，均在 10 以内'}。<span class="todo">待人工确认</span>`,
    `可实现性：按项目时间安排与既往经验评估。<span class="todo">待人工补充</span>`,
    `可测试性：函数输入输出及范围均已列出，圈复杂度已控制。<span class="todo">待人工确认</span>`,
    `可复用性：是否平台化需人工说明。<span class="todo">待人工补充</span>`,
    `安全性：${safetyIds.length > 0 ? '涉及安全相关接口/配置，是否功能安全输出需人工判定' : '是否涉及功能安全需人工判定'}。<span class="todo">待人工确认</span>`,
  ];

  // ---- 各章引导句/说明句 ----
  const droppedExternals = droppedExternalIncludes(model);
  const notes: Record<string, string> = {
    overview: `本模块对外提供 ${model.providedFunctions.length} 个接口函数（左侧为调用方），并调用 ${model.calledExternalFunctions.length - calloutCount} 个外部接口（右侧按来源模块归组）；箭头方向为调用方向。Callout 函数属本模块配置点，不在本图展示，其调用关系见下方内部函数调用图与 6.2；各接口的模块内调用者见内部函数调用图与 5.2.2 表。`,
    callGraph: '按对外接口函数分别绘制其模块内调用树（深蓝=入口函数，灰=内部函数，蓝=被内部调用的对外接口，黄=Callout 函数（配置代码））；同一函数被多处调用时按调用路径重复出现，保证布局无交叉。经配置表函数指针间接引用的 Callout 单独成图。无模块内调用的平凡函数不出图，其余跨模块调用（Gp_RstM / Gp_TstApp 等）见功能接口总图与 5.2.2 表。',
    include: droppedExternals.length > 0
      ? `注：箭头指向被包含的头文件（模板约定：箭头指向被调用的元素）。MemMap.h 为内存映射包装文件，默认被本模块各文件包含，图中不再画出；外部模块头文件（${droppedExternals.join('、')}）不在图中展示，标准类型头文件 Std_Types.h 除外。`
      : '注：箭头指向被包含的头文件（模板约定：箭头指向被调用的元素）。MemMap.h 为内存映射包装文件，默认被本模块各文件包含，图中不再画出。',
    providedVarsEmpty: '注：本模块未提供外部链接的全局变量（即非 static 的文件作用域变量），模块数据均通过函数接口访问。',
    externalVars: '注：本模块未引用外部模块的全局变量，跨模块数据交互均通过函数接口完成。',
    externalFnsCallout: `注：Callout 函数（${calloutCount} 个）属于本模块配置代码（ConfTemplate），由集成方实现，不属于外部接口，未列入本节；其作为功能配置点见 ${calloutSecNo} Callout function，声明见 4.1 文件说明，调用关系见各接口函数卡片的「调用」行。`,
    internalVars: '注：以下为本模块的静态全局变量/常量（<code>static</code> 声明，内部链接，仅本模块内可见，外部模块不可直接访问）；其中 <code>const</code> 修饰的为只读常量，<code>volatile</code> 修饰的为易变变量。',
    configGeneral: '通用配置项适用于所有项目，控制模块基础行为。',
    configFunctional: '功能配置项根据项目需求裁剪模块特性。',
    calloutCfg: 'Callout 函数由集成方在配置代码（ConfTemplate）中实现，是本模块的功能配置点：通过编写/修改 Callout 实现来适配项目策略（核ID获取、阶段初始化、故障处理等）。每个 Callout 为一个独立工作项。',
    evalSummaryIntro: '本模块设计过程中已对上述内容进行评估，各维度说明如下（骨架自动生成，需人工补全/确认）：',
  };

  return {
    purpose: `本文档描述 ${esc(model.module)} 软件单元的详细设计，作为该单元编码实现、设计评审与单元测试的依据。`,
    scope: `本文档适用于 ${esc(model.module)} 软件单元的开发、评审与维护。`,
    // ---- 4.1 文件说明表（原 htmlReport 渲染期现算，物化后 report 只读） ----
    fileTable: [...model.files]
      .sort((a, b) => fileSortKey(a).localeCompare(fileSortKey(b)))
      .map(f => [f.path.split(/[\\/]/).pop()!, describeFile(f.path, f.role, model)]),
    // ---- 5.2.1.1 引用的数据类型表（原 htmlReport 渲染期现算，物化后 report 只读） ----
    importedTypes: buildImportedTypes(model),
    // ---- 7 章圈复杂度明细表（同上；按复杂度降序，排序在 gen 期定死） ----
    complexityTable: [...allFns]
      .sort((a, b) => (b.complexity ?? 0) - (a.complexity ?? 0))
      .map(f => [f.name, f.complexity ?? null, f.infiniteLoop === true]),
    abbreviations,
    abbreviationNote,
    definitions,
    definitionNote,
    abbreviationGaps,
    evaluationRows,
    complexityNote,
    evaluationSummary,
    supportFiles: [
      ['1', '软件详细设计规范（Code）', 'G-B035-005'],
      ['2', '软件接口命名规范', '（待补充）'],
    ],
    supportNote: '注：项目级相关文件（软件架构设计、需求规格等）请人工补充。',
    notes,
  };
}
