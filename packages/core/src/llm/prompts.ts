import type { ConfigMacro, ConfigUsage, ExternalInterface, FunctionUnit, ModuleModel, TypeUnit } from '../model/types.js';

/**
 * Prompt 设计原则（针对 35B 级 MoE 模型）：
 * - 输入全部结构化，不让模型自己"找"信息
 * - 输出格式严格限定，便于程序化校验与重试
 * - 事实性内容（签名/参数/调用）已在静态分析层确定，LLM 只做语义表达
 */

const SYSTEM_DESIGNER = `你是一名汽车嵌入式软件工程师，熟悉 AUTOSAR 架构与 ASPICE SWE.3 软件单元详细设计规范。
你的任务是根据 C 代码的静态分析信息撰写详细设计文档内容。
要求：
1. 只使用输入中给出的事实，禁止编造不存在的函数、变量或行为
2. 使用中文撰写（技术术语、函数名、变量名保持英文原文）
3. 输出严格遵循指定的格式，不要输出任何额外解释`;

/** 接口函数详细描述（5.2.3.2 / 5.2.4.2 的 Description 字段增强） */
export function buildFunctionDescriptionPrompt(
  model: ModuleModel,
  fn: FunctionUnit,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下 C 函数撰写详细设计文档中的功能描述（Description）。`);
  lines.push(``);
  lines.push(`# 函数信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 函数签名: ${fn.signature}`);
  lines.push(`- 函数性质: ${fn.isStatic ? '模块内部函数（static）' : '模块对外接口函数'}`);
  if (fn.comment?.description) {
    lines.push(`- 代码注释中的原始描述: ${fn.comment.description}`);
  }
  if (fn.conditionalFlags.length > 0) {
    lines.push(`- 条件编译: 仅在 ${fn.conditionalFlags.join(', ')} 生效时参与编译`);
  }
  if (fn.innerCondFlags && fn.innerCondFlags.length > 0) {
    lines.push(`- 函数体内部分代码段仅在 ${fn.innerCondFlags.join(', ')} 生效时参与编译`);
  }
  if (fn.calls.length > 0) {
    lines.push(`- 直接调用的函数（按出现顺序）: ${fn.calls.join(', ')}`);
  }
  if (fn.calledBy.length > 0) {
    lines.push(`- 模块内被谁调用: ${fn.calledBy.join(', ')}`);
  }
  if (fn.globalsAccessed.length > 0) {
    lines.push(`- 访问的模块全局变量: ${fn.globalsAccessed.join(', ')}`);
  }
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`用 3~6 句话描述该函数：`);
  lines.push(`1. 核心功能（做什么）`);
  lines.push(`2. 在模块中的角色（结合调用者与被调用者）`);
  lines.push(`3. 关键行为：前置条件、对全局变量的影响、错误处理路径（如输入中有相关信息才写）`);
  lines.push(`直接输出描述正文，不要输出标题、列表编号或任何格式标记。`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}

/** Callout 函数主要功能描述（6.2.x Callout function 各工作项的 Description） */
export function buildCalloutDescriptionPrompt(
  model: ModuleModel,
  ext: ExternalInterface,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下 Callout 函数撰写详细设计文档第 6 章的主要功能描述。`);
  lines.push(`Callout 由集成方在配置代码中实现，是本模块的功能配置点；描述重点是"集成方需要实现什么"。`);
  lines.push(``);
  lines.push(`# Callout 信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 函数签名: ${ext.signature || ext.name}`);
  if (ext.comment?.description) lines.push(`- 头文件注释: ${ext.comment.description.replace(/\n/g, ' ')}`);
  const params = [...(ext.comment?.paramsIn ?? []), ...(ext.comment?.paramsInout ?? []), ...(ext.comment?.paramsOut ?? [])];
  if (params.length > 0) lines.push(`- 参数: ${params.map(p => p.raw).join('；')}`);
  if (ext.comment?.returnValue && ext.comment.returnValue !== 'None') lines.push(`- 返回值: ${ext.comment.returnValue}`);
  lines.push(`- 模块内调用者: ${ext.calledFrom.join(', ')}`);
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`用 1~3 句话说明该 Callout 的主要功能：集成方需要实现什么行为、返回值/输出参数的含义、模块在何时调用它。`);
  lines.push(`直接输出描述正文，不要输出标题、列表编号或任何格式标记。`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}
/** 数据类型描述（5.2.1.2 属性表 Description + 常量/元素说明列；JSON 输出，校验器在 designGenerator） */
export function buildTypeDescriptionPrompt(
  model: ModuleModel,
  t: TypeUnit,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下 C 数据类型撰写详细设计文档 5.2.1.2 节的描述：类型整体用途，以及各成员/各枚举常量取值的说明。`);
  lines.push(``);
  lines.push(`# 类型信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 类型名: ${t.name}`);
  lines.push(`- 类别: ${t.kind === 'struct' ? 'struct 结构体' : `typedef（底层类型 ${t.underlyingType ?? ''}）`}`);
  if (t.comment) lines.push(`- 代码注释: ${t.comment.replace(/\n/g, ' ')}`);
  if (t.kind === 'struct' && (t.elements?.length ?? 0) > 0) {
    lines.push(`- 成员列表:`);
    for (const e of t.elements!) lines.push(`  ${e.name}: ${e.type}${e.comment ? `（原注释: ${e.comment}）` : ''}`);
  }
  if (t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) > 0) {
    lines.push(`- 关联常量（枚举式取值）:`);
    for (const d of t.relatedDefines!) lines.push(`  ${d.name} = ${d.value}${d.comment ? `（原注释: ${d.comment}）` : ''}`);
  }
  // 使用该类型的函数/变量，帮助模型推断用途
  const users = [...model.providedFunctions, ...model.internalFunctions]
    .filter(f => f.signature.includes(t.name)).map(f => f.name);
  if (users.length > 0) lines.push(`- 使用该类型的函数: ${users.join(', ')}`);
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`输出一个 JSON 对象，不要用 \`\`\` 包裹，不要输出任何其他文字。格式：`);
  lines.push(`{`);
  lines.push(`  "comment": "类型整体用途，1~2 句话",`);
  lines.push(`  "elements": { "成员名": "该成员说明（一句话）" },`);
  lines.push(`  "defines": { "常量名": "该取值含义（一句话）" }`);
  lines.push(`}`);
  lines.push(`struct 类型填 comment + elements，枚举式 typedef 填 comment + defines，其余 typedef 只填 comment；`);
  lines.push(`elements/defines 的键必须与上方列表中的名字完全一致，一个不漏；`);
  lines.push(`只使用输入中给出的事实，禁止编造未出现的行为。`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}

/** 非 Callout 外部接口说明（5.2.2.2 调用的外部接口表说明列） */
export function buildExternalDescriptionPrompt(
  model: ModuleModel,
  ext: ExternalInterface,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下外部接口函数撰写详细设计文档 5.2.2.2 节「调用的外部接口」表中的说明，`);
  lines.push(`站在本模块视角：本模块为什么调用它、调用它完成什么。`);
  lines.push(``);
  lines.push(`# 外部接口信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 来源分组: ${ext.group}`);
  lines.push(`- 函数签名: ${ext.signature || ext.name}`);
  if (ext.comment?.description) lines.push(`- 头文件注释: ${ext.comment.description.replace(/\n/g, ' ')}`);
  const params = [...(ext.comment?.paramsIn ?? []), ...(ext.comment?.paramsInout ?? []), ...(ext.comment?.paramsOut ?? [])];
  if (params.length > 0) lines.push(`- 参数: ${params.map(p => p.raw).join('；')}`);
  if (ext.comment?.returnValue && ext.comment.returnValue !== 'None') lines.push(`- 返回值: ${ext.comment.returnValue}`);
  lines.push(`- 模块内调用者: ${ext.calledFrom.join(', ')}`);
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`用 1~2 句话说明本模块调用该接口的目的与作用（结合调用者的功能）；`);
  lines.push(`只使用输入中给出的事实，禁止编造未出现的行为；`);
  lines.push(`直接输出说明正文，不要输出标题、列表编号或任何格式标记。`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}

/** 模块功能描述（5.1，一段话总述 + 要点列表） */
export function buildModuleDescriptionPrompt(
  model: ModuleModel,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为软件模块 ${model.module} 撰写详细设计文档 5.1 节的模块功能描述。`);
  lines.push(``);
  lines.push(`# 模块信息`);
  lines.push(`- 模块名: ${model.module}`);
  lines.push(`- 对外接口函数（${model.providedFunctions.length} 个）:`);
  for (const fn of model.providedFunctions) {
    const firstLine = fn.comment?.description?.split('\n')[0]?.trim();
    lines.push(`  ${fn.name}${firstLine ? `: ${firstLine}` : ''}`);
  }
  const extGroups = new Map<string, number>();
  for (const e of model.calledExternalFunctions.filter(e => e.group !== 'Callout')) {
    extGroups.set(e.group, (extGroups.get(e.group) ?? 0) + 1);
  }
  if (extGroups.size > 0) {
    lines.push(`- 依赖的外部模块: ${[...extGroups.entries()].map(([g, n]) => `${g}（${n} 个接口）`).join('、')}`);
  }
  const callouts = model.calledExternalFunctions.filter(e => e.group === 'Callout');
  if (callouts.length > 0) lines.push(`- 提供 ${callouts.length} 个 Callout 配置点供集成方实现`);
  const funcMacros = model.configMacros.filter(c => c.kind === 'functional');
  if (funcMacros.length > 0) {
    lines.push(`- 功能配置项: ${funcMacros.map(c => `${c.name}=${c.value}`).join('、')}`);
  }
  const stateType = model.types.find(t => t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) >= 3);
  if (stateType) {
    lines.push(`- 内部状态机取值: ${(stateType.relatedDefines ?? []).map(d => d.name).join(', ')}`);
  }
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`1. 先用 2~4 句话总述模块职责与在系统中的角色`);
  lines.push(`2. 然后换行，以 "- " 开头逐条列出 3~6 个主要功能点，每条一句话`);
  lines.push(`3. 只使用输入中给出的事实，禁止编造未出现的接口或行为`);
  lines.push(`4. 直接输出正文，不要输出标题或 "- " 以外的任何格式标记`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}

export function buildConfigValueEffectPrompt(
  model: ModuleModel,
  macro: ConfigMacro,
): { system: string; user: string } {
  const KIND_LABEL: Record<ConfigUsage['kind'], string> = {
    condCompile: '条件编译裁剪',
    arrayDim: '数组维度',
    loopBound: '循环上界',
    call: '代码中调用',
    reference: '引用',
  };
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下 C 配置宏撰写详细设计文档第 6 章的「取值影响」说明，即该配置项怎么使用、取不同值时的行为差异。`);
  lines.push(``);
  lines.push(`# 配置宏信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 宏名: ${macro.name}`);
  lines.push(`- 当前取值: ${macro.value || '(空)'}`);
  lines.push(`- 分类: ${macro.kind === 'functional' ? '功能配置（按项目需求裁剪特性）' : '通用配置（所有项目通用的基础行为）'}`);
  if (macro.comment) lines.push(`- 代码注释: ${macro.comment}`);
  lines.push(``);
  lines.push(`# 使用事实（静态分析结果，必须以其为准）`);
  if (macro.usages.length === 0) {
    lines.push(`- 模块内未发现引用点`);
  } else {
    const byKind = new Map<string, number>();
    for (const u of macro.usages) byKind.set(u.kind, (byKind.get(u.kind) ?? 0) + 1);
    for (const [k, n] of byKind) lines.push(`- ${KIND_LABEL[k as ConfigUsage['kind']]}: ${n} 处`);
    const condExprs = [...new Set(macro.usages.filter(u => u.kind === 'condCompile').map(u => u.context.replace(/^#\s*(if|elif)\s*/, '')))];
    if (condExprs.length > 0) lines.push(`- 条件编译表达式: ${condExprs.join(' ; ')}`);
  }
  if (macro.affects.length > 0) {
    lines.push(`- 条件编译直接影响的函数/变量: ${macro.affects.join(', ')}`);
  }
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`用 2~4 句话说明：`);
  lines.push(`1. 该配置项控制什么行为`);
  lines.push(`2. 各候选取值（如 STD_ON/STD_OFF 或数值范围）分别产生什么效果`);
  lines.push(`3. 与其他配置项的依赖关系（仅当使用事实中有体现才写）`);
  lines.push(`直接输出说明正文，不要输出标题、列表编号或任何格式标记。`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}
/** 状态机迁移标签润色（09-20 用户定调「结构确定+LLM 只润色标签」）：
 *  结构与迁移由 stateMachineBuilder 确定性提取（零幻觉），LLM 只把机械标签
 *  （条件表达式原文/英文注释/状态内容函数列表）润色为简洁中文短句。输入输出均为 JSON 对象。
 *  条目两类：键 "1".."n"=迁移触发条件（边标签）；键 "C1".."Ck"=状态内容（某状态存续期间做的事） */
export function buildSmLabelPolishPrompt(
  labels: string[],
  contents: string[],
  module: string,
  role: 'master' | 'satellite' | null,
  bares: string[] = [],
): { system: string; user: string } {
  const roleDesc = role === 'master' ? '主核 Core0 视角（动作主体是 master）'
    : role === 'satellite' ? '从核 satellite 视角（动作主体是 satellite）'
    : '单核视角';
  const entries: [string, string][] = labels.map((l, i) => [String(i + 1), l]);
  bares.forEach((b, i) => entries.push([`U${i + 1}`, b]));
  contents.forEach((c, i) => entries.push([`C${i + 1}`, c]));
  const input = JSON.stringify(Object.fromEntries(entries), null, 1);
  const user = `「${module}」模块状态机标签润色（${roleDesc}）：以下条目由工具从 C 代码机械提取，请逐条润色为简洁中文短句，用作状态机图标签。
条目三类：数字键 = 迁移触发条件（条件表达式原文或英文注释）；U 开头键 = 无标签迁移（只给了源/目标状态与代码事实，请补一句动作描述）；C 开头键 = 状态内容（该状态存续期间执行的函数列表，「等 N 项」表示还有函数未列出）。
要求：
1. 忠实原意：!(A) 表示 A 不成立，&& 表示且，|| 表示或；不得增删条件、不得发明代码中不存在的含义
2. 触发条件与 U 类每条不超过 30 字，状态内容每条不超过 50 字
3. 句式以角色开头描述动作（如「master 初始化启动数据并置位阶段一」「satellite 自旋等待主核置位阶段二」）；目标状态用中文名（置位阶段二、进 NORMAL 态）
4. 宏/变量保留可识别核心词（如 TryPwrShdn_b → 试断电标志、STPSTAGE_TWO → 阶段二）；函数名可去模块前缀留核心词（Gp_RstM_InitOne → RstM_InitOne）
5. Callout 函数名保留原文不翻译
6. 「（自旋等待退出）」表示等到该条件成立、自旋等待退出时发生迁移；可改写为句内表达（如「自旋等待主核置位阶段二」），不必保留括注
7. 状态内容可概括为一句语义描述（依据函数名推断用途），保留 1~2 个关键函数名即可，「等 N 项」计数可省略
8. U 类只依据所给事实（函数名、状态内容调用）写动作描述，不要编造没有依据的细节；上下文提到「函数执行完毕返回」的，写「…完成，函数返回」式描述（这是状态机的结束状态边）
9. 只输出 JSON 对象，键与输入一致，不要输出任何其他内容
输入：
\`\`\`json
${input}
\`\`\``;
  return { system: SYSTEM_DESIGNER, user };
}
