import type {
  ModuleModel, FunctionUnit, DynamicDesign, StateMachineDesign, SequenceDesign, TypeUnit,
} from '../model/types.js';
import type { LLMProvider } from '../llm/provider.js';
import {
  buildFunctionDescriptionPrompt, buildFlowchartPrompt,
  buildStateMachinePrompt, buildSequencePrompt, buildConfigValueEffectPrompt,
  buildCalloutDescriptionPrompt, buildTypeDescriptionPrompt,
  buildExternalDescriptionPrompt, buildModuleDescriptionPrompt,
} from '../llm/prompts.js';
import { lintMermaidSource, lintFlowchartStructure } from '../report/mermaidPre.js';

/** 从 LLM 输出中提取 Mermaid 源码（剥 ```mermaid 围栏）；非法则抛错 */
function extractMermaid(expectedStart: RegExp, kindHint: string): (output: string) => string {
  return (output: string) => {
    let text = output.trim();
    const fence = text.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/);
    if (fence) {
      text = fence[1].trim();
    } else {
      // 无围栏时兜底：模型若在图代码前后加了解释文字，从第一个图起始行截取
      const lines = text.split('\n');
      const startIdx = lines.findIndex(l => expectedStart.test(l.trim()));
      if (startIdx > 0) text = lines.slice(startIdx).join('\n').trim();
    }
    const firstLine = text.replace(/\n/g, '\n      ').trim();
    if (!expectedStart.test(firstLine)) {
      // 面向模型的中文反馈（会随重试回喂给 LLM），避免只给正则表达式
      throw new Error(`你的输出不是有效的 Mermaid 图代码。要求：第一行必须是 ${kindHint}，只输出图代码本身，不要输出任何解释、描述或分析文字。请重新输出。`);
    }
    // 无标题 subgraph 缺样式兜底：Qwen 常漏写 style（如 IoMcuAdc MainFunction 的 LOOP_BODY），
    // 默认渲染成可见灰框；泳道/逻辑分组框都应隐形。
    // 条件编译虚线框由 prompt 规则 6 显式给 dashed style（已写 style 的不在此列），不受影响
    if (/^(flowchart|graph)\s/.test(firstLine)) {
      const styled = new Set([...text.matchAll(/^\s*style\s+([A-Za-z0-9_]+)\s/gm)].map(m => m[1]));
      const missing = [...text.matchAll(/^\s*subgraph\s+([A-Za-z0-9_]+)\s*\["\s*"\]/gm)]
        .map(m => m[1])
        .filter(id => !styled.has(id));
      if (missing.length > 0) {
        text += '\n' + missing.map(id => `    style ${id} fill:transparent,stroke:transparent`).join('\n');
      }
    }
    return text;
  };
}

/** 流程图输出校验：extractMermaid 提取 + 词法 lint + 结构 lint；问题拼成中文反馈随重试回喂 */
function validateFlowchart(output: string): string {
  const text = extractMermaid(/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)/, 'flowchart TD')(output);
  const problems = [...lintMermaidSource(text), ...lintFlowchartStructure(text)];
  if (problems.length > 0) {
    throw new Error(
      `你的流程图存在以下 ${problems.length} 个问题：\n` +
      problems.map((p, i) => `${i + 1}. ${p}`).join('\n') +
      '\n请修正后重新输出完整的图代码（仍然只输出图代码本身）。',
    );
  }
  return text;
}

/** 带重试的生成（格式校验失败时把错误回喂） */
async function generateWithRetry<T>(
  provider: LLMProvider,
  system: string,
  user: string,
  validate: (output: string) => T,
  maxRetries = 2,
): Promise<T> {
  let lastError = '';
  let currentUser = user;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (lastError) {
      currentUser = `${user}\n\n# 上次输出的问题\n${lastError}\n请修正后重新输出，严格遵守格式要求。`;
    }
    const output = await provider.generate(system, currentUser);
    try {
      return validate(output);
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  throw new Error(`LLM 生成失败（重试 ${maxRetries} 次）: ${lastError}`);
}

/** 序列图输出校验：允许「### 角色名」分段的多张图（多核模块按角色分图），剥围栏/前言后整体返回 */
function extractSequenceSet(output: string): string {
  let text = output.trim();
  const fence = text.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const lines = text.split('\n');
  const startIdx = lines.findIndex(l => /^sequenceDiagram/.test(l.trim()) || /^### .+/.test(l.trim()));
  if (startIdx > 0) text = lines.slice(startIdx).join('\n').trim();
  if (!/^(### .+\n+)?sequenceDiagram/.test(text)) {
    throw new Error(`你的输出不是有效的 Mermaid 图代码。要求：第一行必须是 sequenceDiagram（多角色分图时每张图前一行写 ### 角色名），只输出图代码本身，不要输出任何解释、描述或分析文字。请重新输出。`);
  }
  return text;
}

/** 把「### 角色名」分段的多张序列图拆成 {role, diagram} 列表；无分段则单图 role=null */
function splitSequenceRoles(text: string): { role: string | null; diagram: string }[] {
  const marks: { role: string; start: number; bodyStart: number }[] = [];
  for (const m of text.matchAll(/^### (.+)$/gm)) {
    marks.push({ role: m[1].trim(), start: m.index, bodyStart: m.index + m[0].length });
  }
  if (marks.length === 0) return [{ role: null, diagram: text.trim() }];
  return marks.map((mk, i) => ({
    role: mk.role,
    diagram: text.slice(mk.bodyStart, i + 1 < marks.length ? marks[i + 1].start : undefined).trim(),
  }));
}

/** 判断函数是否需要流程图：有分支/循环且非单行透传 */
function needsFlowchart(_fn: FunctionUnit): boolean {
  // 参照既有详细设计文档颗粒度：每个函数工作项都配流程图（含平凡 setter）
  return true;
}

type TypeGenerated = NonNullable<TypeUnit['generated']>;

/** 类型描述输出校验：优先解析 JSON（comment + defines/elements 字典）；非 JSON 时整段兜底为 comment */
function validateTypeDescription(t: TypeUnit): (output: string) => Omit<TypeGenerated, 'llmModel' | 'generatedAt'> {
  return (output: string) => {
    let text = output.trim();
    const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    // 模型若在 JSON 前后加解释文字，截取第一个 {...} 块再解析
    let obj: { comment?: unknown; defines?: unknown; elements?: unknown } | null = null;
    try {
      obj = JSON.parse(text);
    } catch {
      const block = text.match(/\{[\s\S]*\}/);
      if (block) {
        try { obj = JSON.parse(block[0]); } catch { obj = null; }
      }
    }
    if (!obj) {
      // 非 JSON 输出兜底：整段作为类型整体描述，成员/常量说明留空（报告回退源码注释）
      if (text.length < 10) throw new Error('描述过短（<10字符）');
      return { comment: text };
    }
    const comment = typeof obj.comment === 'string' ? obj.comment.trim() : '';
    if (comment.length < 10) {
      throw new Error('JSON 中 comment 缺失或过短（<10字符）。要求：输出 JSON 对象，comment 为类型整体用途（1~2 句话）。请重新输出。');
    }
    // 只收键名与静态分析列表完全一致的条目，防编造键污染表格
    const pick = (src: unknown, names: string[] | undefined): Record<string, string> | undefined => {
      if (!names?.length || src == null || typeof src !== 'object') return undefined;
      const out: Record<string, string> = {};
      for (const n of names) {
        const v = (src as Record<string, unknown>)[n];
        if (typeof v === 'string' && v.trim()) out[n] = v.trim();
      }
      return Object.keys(out).length > 0 ? out : undefined;
    };
    return {
      comment,
      defines: pick(obj.defines, t.relatedDefines?.map(d => d.name)),
      elements: pick(obj.elements, t.elements?.map(e => e.name)),
    };
  };
}

/** 为单个函数生成流程图 */
async function genFlowchart(
  model: ModuleModel,
  fn: FunctionUnit,
  provider: LLMProvider,
): Promise<void> {
  if (!needsFlowchart(fn)) return;
  const fc = buildFlowchartPrompt(model, fn);
  // 流程图结构复杂、校验严格，给 3 次重试（其余生成维持默认 2 次）
  const diagram = await generateWithRetry(provider, fc.system, fc.user, validateFlowchart, 3);
  fn.generated = fn.generated ?? {
    detailedDescription: '', llmModel: provider.name, generatedAt: new Date().toISOString(),
  };
  fn.generated.flowchart = diagram;
  fn.generated.flowchartFormat = 'mermaid';
}

/** 为单个函数生成增强描述（+ 流程图） */
async function enrichFunction(
  model: ModuleModel,
  fn: FunctionUnit,
  provider: LLMProvider,
): Promise<void> {
  const { system, user } = buildFunctionDescriptionPrompt(model, fn);
  const text = await generateWithRetry(provider, system, user, (o) => {
    const cleaned = o.trim();
    if (cleaned.length < 20) throw new Error('描述过短（<20字符）');
    return cleaned;
  });
  fn.generated = {
    detailedDescription: text,
    llmModel: provider.name,
    generatedAt: new Date().toISOString(),
  };

  await genFlowchart(model, fn, provider);
}

/** 生成动态设计（5.3 状态机 + 序列图）；skip 用于 --resume 时只补缺的一半 */
async function generateDynamicDesign(
  model: ModuleModel,
  provider: LLMProvider,
  skip?: { stateMachine?: boolean; sequences?: boolean },
): Promise<DynamicDesign> {
  const result: DynamicDesign = { stateMachine: null, sequences: [] };

  // ---- 状态机 ----
  const smPrompt = skip?.stateMachine ? null : buildStateMachinePrompt(model);
  if (smPrompt) {
    const diagram = await generateWithRetry(provider, smPrompt.system, smPrompt.user, extractMermaid(/^stateDiagram-v2/, 'stateDiagram-v2'));
    result.stateMachine = {
      name: `${model.module} 状态机`,
      diagram,
      diagramFormat: 'mermaid',
      states: smPrompt.states,
      transitions: [],
      polarion: {
        isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine',
        title: `${model.module} 状态机`, workItemId: null,
      },
    } satisfies StateMachineDesign;
  }

  // ---- 序列图：初始化入口 + 周期入口（命名约定 _Startup|_Init / _MainFunction|_Mainfunction，大小写兼容） ----
  const scenarios: { pattern: RegExp; scenario: string }[] = [
    { pattern: /_(Startup|Init)$/i, scenario: 'Initialization' },
    { pattern: /_MainFunction$/i, scenario: 'Runtime' },
  ];
  for (const { pattern, scenario } of skip?.sequences ? [] : scenarios) {
    const fn = model.providedFunctions.find(f => pattern.test(f.name));
    if (!fn) continue;
    const { system, user } = buildSequencePrompt(model, fn, scenario);
    const text = await generateWithRetry(provider, system, user, extractSequenceSet);
    // 多核模块按角色分图：### 主核 Core0 / ### 从核 satellite 各成一张工作项
    for (const part of splitSequenceRoles(text)) {
      const name = part.role ? `${scenario}（${part.role}）` : scenario;
      result.sequences.push({
        name,
        diagram: part.diagram,
        diagramFormat: 'mermaid',
        description: fn.comment?.description?.replace(/\n/g, '\n      ') ?? '',
        polarion: {
          isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence',
          title: part.role ? `${model.module} ${scenario} 序列图（${part.role}）` : `${model.module} ${scenario} 序列图`,
          workItemId: null,
        },
      } satisfies SequenceDesign);
    }
  }

  return result;
}

export interface GenerateOptions {
  /** 只生成指定条目（函数名或 'dynamic'/'configs'/'callouts'/'flowcharts'/'types'/'externals'/'description'），空 = 全部 */
  only?: string[];
  /** 断点续跑：跳过已有 generated 内容的条目（配合 CLI --resume） */
  skipExisting?: boolean;
  /** 进度回调 */
  onProgress?: (msg: string) => void;
  /** 失败收集：单条目失败不中断整批，失败原因 push 进该数组由调用方汇总 */
  failures?: string[];
}

/** 生成入口：就地增强 model（函数 generated 字段 + dynamicDesign） */
export async function generateDesign(
  model: ModuleModel,
  provider: LLMProvider,
  opts?: GenerateOptions,
): Promise<ModuleModel> {
  const log = opts?.onProgress ?? (() => {});
  const only = opts?.only;
  const skipExisting = opts?.skipExisting ?? false;

  // --only flowcharts：只重刷各函数的流程图，保留已生成的描述等其余内容
  if (only?.includes('flowcharts')) {
    const fnFilter = only.filter(o => o !== 'flowcharts');
    for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
      if (fnFilter.length > 0 && !fnFilter.includes(fn.name)) continue;
      log(`重新生成流程图: ${fn.name}`);
      try {
        await genFlowchart(model, fn, provider);
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${fn.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${fn.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
    return model;
  }

  const allFunctions = [...model.providedFunctions, ...model.internalFunctions];
  const targets = only
    ? allFunctions.filter(f => only.includes(f.name))
    : allFunctions;

  for (const fn of targets) {
    if (skipExisting && fn.generated?.detailedDescription && fn.generated.flowchart) {
      log(`跳过（已有生成内容）: ${fn.name}`);
      continue;
    }
    log(`生成描述: ${fn.name}`);
    try {
      await enrichFunction(model, fn, provider);
    } catch (err) {
      log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${fn.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      opts?.failures?.push(`${fn.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
    }
  }

  if ((!only || only.includes('dynamic'))) {
    // 空壳 dynamicDesign（stateMachine=null 且 sequences=[]）不算已有——否则失败后 --resume 永远跳过；
    // 粒度细分：状态机与序列图各自判断，--resume 只补缺的一半
    //（如手工清掉 sequences 重出时保留已验收的状态机，避免 TLF 宏族状态机被重抽）
    const existing = model.dynamicDesign ?? undefined;
    const keepSM = !!(skipExisting && existing?.stateMachine);
    const keepSeq = !!(skipExisting && existing && existing.sequences.length > 0);
    if (keepSM && keepSeq) {
      log('跳过（已有动态设计）');
    } else {
      log('生成动态设计（状态机/序列图）');
      try {
        const fresh = await generateDynamicDesign(model, provider, { stateMachine: keepSM, sequences: keepSeq });
        model.dynamicDesign = {
          stateMachine: keepSM ? existing!.stateMachine : fresh.stateMachine,
          sequences: keepSeq ? existing!.sequences : fresh.sequences,
        };
      } catch (err) {
        log(`  ⚠ 动态设计失败（已跳过，可 --resume 重试）: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`dynamic: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  if (!only || only.includes('configs')) {
    for (const macro of model.configMacros) {
      if (macro.kind === 'alias') continue;   // 别名宏非配置项，不生成取值说明
      if (skipExisting && macro.generated?.valueEffect) {
        log(`跳过（已有配置说明）: ${macro.name}`);
        continue;
      }
      log(`生成配置说明: ${macro.name}`);
      const { system, user } = buildConfigValueEffectPrompt(model, macro);
      try {
        const text = await generateWithRetry(provider, system, user, (o) => {
          const cleaned = o.trim();
          if (cleaned.length < 10) throw new Error('说明过短（<10字符）');
          return cleaned;
        });
        macro.generated = {
          valueEffect: text,
          llmModel: provider.name,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${macro.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${macro.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  if (!only || only.includes('callouts')) {
    for (const ext of model.calledExternalFunctions.filter(e => e.group === 'Callout')) {
      if (skipExisting && ext.generated?.detailedDescription) {
        log(`跳过（已有 Callout 描述）: ${ext.name}`);
        continue;
      }
      log(`生成 Callout 描述: ${ext.name}`);
      const { system, user } = buildCalloutDescriptionPrompt(model, ext);
      try {
        const text = await generateWithRetry(provider, system, user, (o) => {
          const cleaned = o.trim();
          if (cleaned.length < 10) throw new Error('描述过短（<10字符）');
          return cleaned;
        });
        ext.generated = {
          detailedDescription: text,
          llmModel: provider.name,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${ext.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${ext.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  if (!only || only.includes('types')) {
    for (const t of model.types) {
      if (skipExisting && t.generated?.comment) {
        log(`跳过（已有类型描述）: ${t.name}`);
        continue;
      }
      log(`生成类型描述: ${t.name}`);
      const { system, user } = buildTypeDescriptionPrompt(model, t);
      try {
        const parsed = await generateWithRetry(provider, system, user, validateTypeDescription(t));
        t.generated = {
          ...parsed,
          llmModel: provider.name,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${t.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${t.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  if (!only || only.includes('externals')) {
    for (const ext of model.calledExternalFunctions.filter(e => e.group !== 'Callout')) {
      if (skipExisting && ext.generated?.detailedDescription) {
        log(`跳过（已有外部接口说明）: ${ext.name}`);
        continue;
      }
      log(`生成外部接口说明: ${ext.name}`);
      const { system, user } = buildExternalDescriptionPrompt(model, ext);
      try {
        const text = await generateWithRetry(provider, system, user, (o) => {
          const cleaned = o.trim();
          if (cleaned.length < 10) throw new Error('说明过短（<10字符）');
          return cleaned;
        });
        ext.generated = {
          detailedDescription: text,
          llmModel: provider.name,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${ext.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${ext.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  if (!only || only.includes('description')) {
    if (skipExisting && model.functionalDescription) {
      log('跳过（已有模块功能描述）');
    } else {
      log('生成模块功能描述（5.1）');
      const { system, user } = buildModuleDescriptionPrompt(model);
      try {
        const text = await generateWithRetry(provider, system, user, (o) => {
          const cleaned = o.trim();
          if (cleaned.length < 20) throw new Error('描述过短（<20字符）');
          return cleaned;
        });
        model.functionalDescription = text;
      } catch (err) {
        log(`  ⚠ 模块功能描述失败（已跳过，可 --resume 重试）: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`description: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
  }

  return model;
}
