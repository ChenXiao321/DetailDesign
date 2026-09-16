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
export interface StateMachinePromptResult {
  system: string;
  user: string;
  /** 状态清单（枚举路径带注释；宏族退路路径无注释，描述留空） */
  states: { name: string; description: string }[];
}

export function buildStateMachinePrompt(model: ModuleModel): StateMachinePromptResult | null {
  // 首选：枚举式 typedef（带 relatedDefines 的）作为状态机候选
  const stateType = model.types.find(t => t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) >= 3);

  const lines: string[] = [];
  if (stateType) {
    lines.push(`# 任务`);
    lines.push(`根据以下 C 代码事实，为模块 ${model.module} 绘制状态机图（Mermaid stateDiagram-v2 语法）。`);
    lines.push(``);
    lines.push(`# 状态类型定义`);
    lines.push(`类型 ${stateType.name}（底层类型 ${stateType.underlyingType}），可选值：`);
    for (const d of stateType.relatedDefines ?? []) {
      lines.push(`- ${d.name} = ${d.value}${d.comment ? `（${d.comment}）` : ''}`);
    }
    lines.push(``);
    lines.push(`# 状态相关代码事实`);
    for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
      const desc = fn.comment?.description ?? '';
      if (/stage|state|status/i.test(desc) || fn.name === `${model.module}_Startup`) {
        lines.push(`- 函数 ${fn.name}: ${desc.replace(/\n/g, ' ')}`);
        if (fn.calls.length > 0) lines.push(`  调用: ${fn.calls.slice(0, 10).join(', ')}`);
      }
    }
    return finishStateMachinePrompt(model, lines, (stateType.relatedDefines ?? []).map(d => ({
      name: d.name,
      description: d.comment ?? '',
    })));
  }

  // 退路：无枚举式 typedef（如 TLF35584 用 <前缀>_<名>_STATE 宏族驱动状态变量），
  // 从函数体扫描宏族，把引用这些宏的函数体一并喂给模型提取状态机
  const fns = [...model.providedFunctions, ...model.internalFunctions];
  const familyRe = /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)*?)_([A-Z0-9]+)_(STATE|MODE|STAGE)\b/g;
  const families = new Map<string, { names: Set<string>; suffix: string; prefix: string }>();
  for (const fn of fns) {
    for (const m of fn.bodyText.matchAll(familyRe)) {
      const key = `${m[1]}_*_${m[3]}`;
      if (!families.has(key)) families.set(key, { names: new Set(), suffix: m[3], prefix: m[1] });
      families.get(key)!.names.add(m[2]);
    }
  }
  const best = [...families.values()].filter(f => f.names.size >= 3)
    .sort((a, b) => b.names.size - a.names.size)[0];
  if (!best) return null;

  const stateNames = [...best.names];
  lines.push(`# 任务`);
  lines.push(`根据以下 C 代码事实，为模块 ${model.module} 绘制状态机图（Mermaid stateDiagram-v2 语法）。`);
  lines.push(``);
  lines.push(`# 状态取值（宏族 ${best.prefix}_*_${best.suffix}）`);
  for (const n of stateNames) lines.push(`- ${best.prefix}_${n}_${best.suffix}（短名 ${n}）`);
  lines.push(`注意：这些取值可能分属多个状态变量（如模块运行状态与器件模式）——以为模块主流程服务、`);
  lines.push(`在源码中被赋值/比较最频繁的那个状态变量为准绘制，属于其他变量的取值不要画进图里。`);
  lines.push(``);
  lines.push(`# 引用这些状态的函数源码（状态迁移事实以其为准）`);
  for (const fn of fns) {
    if (!fn.bodyText.includes(`${best.prefix}_`)) continue;
    lines.push(`## ${fn.name}`);
    if (fn.comment?.description) lines.push(`功能: ${fn.comment.description.split('\n')[0]}`);
    lines.push('```c');
    lines.push(fn.bodyText);
    lines.push('```');
  }
  return finishStateMachinePrompt(model, lines, stateNames.map(n => ({ name: n, description: '' })));
}

function finishStateMachinePrompt(
  model: ModuleModel,
  lines: string[],
  states: { name: string; description: string }[],
): StateMachinePromptResult {
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`1. 第一行必须是 stateDiagram-v2，只输出图代码本身，不要用 \`\`\` 包裹，不要输出任何解释`);
  lines.push(`2. 状态名使用定义值去掉前缀后的短名（如 STPSTAGE_ONE → ONE）`);
  lines.push(`3. 迁移格式: 源状态 --> 目标状态 : 触发条件（触发条件中不要出现冒号）`);
  lines.push(`4. 用 [*] 表示初始/终止伪状态`);
  lines.push(`5. 补充说明用 note right of <状态> : 内容（单行）`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n'), states };
}

/** 序列图 Mermaid（5.3.2）——为指定函数场景生成 */
export function buildSequencePrompt(
  model: ModuleModel,
  fn: FunctionUnit,
  scenarioName: string,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为模块 ${model.module} 的"${scenarioName}"场景绘制序列图（Mermaid sequenceDiagram 语法），`);
  lines.push(`展示函数 ${fn.name} 执行过程中与各外部模块的交互顺序。`);
  lines.push(``);
  lines.push(`# 函数信息`);
  lines.push(`- 签名: ${fn.signature}`);
  if (fn.comment?.description) lines.push(`- 功能: ${fn.comment.description.replace(/\n/g, ' ')}`);
  lines.push(`- 调用顺序（代码中出现的先后）:`);
  fn.calls.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  if (fn.globalsAccessed.length > 0) {
    lines.push(`- 访问的全局变量: ${fn.globalsAccessed.join(', ')}`);
  }
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`1. 第一行必须是 sequenceDiagram，只输出图代码本身，不要用 \`\`\` 包裹，不要输出任何解释`);
  lines.push(`2. 参与者只建「模块」粒度：调用者用 actor（如 OS/EcuM），本模块与每个交互的外部模块（如 Gp_RstM、SBC）各一个 participant，声明时起短别名: participant RM as Gp_RstM`);
  lines.push(`   本模块的 Callout 函数属于本模块（是模块留给集成方的接口），不得为 Callout 建参与者——调用 Callout 画成自调用: 本模块->>本模块: CalloutXxx()`);
  lines.push(`3. 消息格式: A->>B: 消息名，按调用顺序排列`);
  lines.push(`4. 控制流必须用组合片段标注，禁止把分支/循环体平铺成普通消息：互斥分支用 alt [条件] / else [条件]；仅在某条件下执行的可选段用 opt [条件]；循环（如遍历每个通道、计数分频）用 loop [循环条件]；各片段以 end 结束。自调用用 A->>A: 说明，注释用 Note over/right of`);
  lines.push(`5. 消息文本中不要出现冒号、分号、# 号`);
  lines.push(`6. 若函数行为依赖核角色（主核 master/Core0 与从核 satellite 路径不同，如按 GetCoreId 返回值分支），不要画在一张图里——按核角色分别绘制：每个角色一张完整 sequenceDiagram，每张图前一行写 ### 角色名（如 ### 主核 Core0、### 从核 satellite）；角色图内只保留该角色的参与者，跨核同步（自旋等待、屏障置位）用 Note 说明，不为另一角色建参与者`);
  lines.push(`7. 行为无核角色差异时只出一张图，不写 ### 行`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}
