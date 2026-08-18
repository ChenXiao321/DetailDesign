import type { ConfigMacro, ConfigUsage, ExternalInterface, FunctionUnit, ModuleModel } from '../model/types.js';

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

/** 函数流程图 Mermaid（5.2.3.2/5.2.4.2 的 Description 配图） */
export function buildFlowchartPrompt(
  model: ModuleModel,
  fn: FunctionUnit,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`根据以下 C 函数的源码，绘制该函数的执行流程图（Mermaid flowchart TD 语法）。`);
  lines.push(``);
  lines.push(`# 函数信息`);
  lines.push(`- 所属模块: ${model.module}`);
  lines.push(`- 签名: ${fn.signature}`);
  if (fn.comment?.description) lines.push(`- 功能: ${fn.comment.description.split('\n')[0]}`);
  if (fn.conditionalFlags.length > 0) {
    lines.push(`- 条件编译: ${fn.conditionalFlags.join(', ')} 生效时参与编译`);
  }
  lines.push(``);
  lines.push(`# 函数源码`);
  lines.push('```c');
  lines.push(fn.bodyText);
  lines.push('```');
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`1. 第一行必须是 flowchart TD，只输出图代码本身，不要用 \`\`\` 包裹，不要输出任何解释`);
  lines.push(`2. 节点格式: 处理步骤用矩形 id["说明"]，判断用菱形 id{"条件"}，开始/结束用 id(["开始"])`);
  lines.push(`3. 分支格式: A --> B，带条件用 A -- 是 --> B / A -- 否 --> C`);
  lines.push(`4. 节点说明用中文简述行为（可含英文函数名），合并连续赋值等琐碎步骤，节点总数控制在 20 个以内`);
  lines.push(`5. 所有节点标签必须用双引号包裹，标签内不要出现双引号、冒号、分号；换行用 <br>`);
  lines.push(`6. 条件编译包裹的代码段，在节点说明中注明（条件编译）`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}

/** Callout 函数主要功能描述（6.2.x Callout function 各工作项的 Description） */
export function buildCalloutDescriptionPrompt(
  model: ModuleModel,
  ext: ExternalInterface,
): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`# 任务`);
  lines.push(`为以下 Callout 回调函数撰写详细设计文档第 6 章的主要功能描述。`);
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
export function buildStateMachinePrompt(model: ModuleModel): { system: string; user: string } | null {
  // 找枚举式 typedef（带 relatedDefines 的）作为状态机候选
  const stateType = model.types.find(t => t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) >= 3);
  if (!stateType) return null;

  const lines: string[] = [];
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
  lines.push(``);
  lines.push(`# 输出要求`);
  lines.push(`1. 第一行必须是 stateDiagram-v2，只输出图代码本身，不要用 \`\`\` 包裹，不要输出任何解释`);
  lines.push(`2. 状态名使用定义值去掉前缀后的短名（如 STPSTAGE_ONE → ONE）`);
  lines.push(`3. 迁移格式: 源状态 --> 目标状态 : 触发条件（触发条件中不要出现冒号）`);
  lines.push(`4. 用 [*] 表示初始/终止伪状态`);
  lines.push(`5. 补充说明用 note right of <状态> : 内容（单行）`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
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
  lines.push(`2. 参与者用 participant 声明并起短别名: participant CO as Callout；调用者用 actor（如 OS/EcuM）`);
  lines.push(`3. 消息格式: A->>B: 消息名，按调用顺序排列`);
  lines.push(`4. 条件分支用 alt/else/end，自调用用 A->>A: 说明，注释用 Note over/right of`);
  lines.push(`5. 消息文本中不要出现冒号、分号、# 号`);
  return { system: SYSTEM_DESIGNER, user: lines.join('\n') };
}
