import type {
  ModuleModel, FunctionUnit, DynamicDesign, StateMachineDesign, SequenceDesign,
} from '../model/types.js';
import type { LLMProvider } from '../llm/provider.js';
import {
  buildFunctionDescriptionPrompt, buildFlowchartPrompt,
  buildStateMachinePrompt, buildSequencePrompt, buildConfigValueEffectPrompt,
  buildCalloutDescriptionPrompt,
} from '../llm/prompts.js';

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
    const firstLine = text.split('\n')[0].trim();
    if (!expectedStart.test(firstLine)) {
      // 面向模型的中文反馈（会随重试回喂给 LLM），避免只给正则表达式
      throw new Error(`你的输出不是有效的 Mermaid 图代码。要求：第一行必须是 ${kindHint}，只输出图代码本身，不要输出任何解释、描述或分析文字。请重新输出。`);
    }
    return text;
  };
}

/** 带重试的生成（格式校验失败时把错误回喂） */
async function generateWithRetry(
  provider: LLMProvider,
  system: string,
  user: string,
  validate: (output: string) => string,
  maxRetries = 2,
): Promise<string> {
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

/** 判断函数是否需要流程图：有分支/循环且非单行透传 */
function needsFlowchart(_fn: FunctionUnit): boolean {
  // 参照既有详细设计文档颗粒度：每个函数工作项都配流程图（含平凡 setter）
  return true;
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

  // 流程图：仅有控制流的函数
  if (needsFlowchart(fn)) {
    const fc = buildFlowchartPrompt(model, fn);
    const diagram = await generateWithRetry(
      provider, fc.system, fc.user, extractMermaid(/^(flowchart|graph)\s+(TD|TB|BT|LR|RL)/, 'flowchart TD'),
    );
    fn.generated.flowchart = diagram;
    fn.generated.flowchartFormat = 'mermaid';
  }
}

/** 生成动态设计（5.3 状态机 + 序列图） */
async function generateDynamicDesign(
  model: ModuleModel,
  provider: LLMProvider,
): Promise<DynamicDesign> {
  const result: DynamicDesign = { stateMachine: null, sequences: [] };

  // ---- 状态机 ----
  const smPrompt = buildStateMachinePrompt(model);
  if (smPrompt) {
    const diagram = await generateWithRetry(provider, smPrompt.system, smPrompt.user, extractMermaid(/^stateDiagram-v2/, 'stateDiagram-v2'));
    const stateType = model.types.find(t => t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) >= 3);
    result.stateMachine = {
      name: `${model.module} 状态机`,
      diagram,
      diagramFormat: 'mermaid',
      states: (stateType?.relatedDefines ?? []).map(d => ({
        name: d.name,
        description: d.comment ?? '',
      })),
      transitions: [],
      polarion: {
        isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine',
        title: `${model.module} 状态机`, workItemId: null,
      },
    } satisfies StateMachineDesign;
  }

  // ---- 序列图：Startup（初始化）+ Mainfunction（周期运行） ----
  const scenarios: { fnName: string; scenario: string }[] = [
    { fnName: `${model.module}_Startup`, scenario: 'Initialization' },
    { fnName: `${model.module}_Mainfunction`, scenario: 'Runtime' },
  ];
  for (const { fnName, scenario } of scenarios) {
    const fn = model.providedFunctions.find(f => f.name === fnName);
    if (!fn) continue;
    const { system, user } = buildSequencePrompt(model, fn, scenario);
    const diagram = await generateWithRetry(provider, system, user, extractMermaid(/^sequenceDiagram/, 'sequenceDiagram'));
    result.sequences.push({
      name: scenario,
      diagram,
      diagramFormat: 'mermaid',
      description: fn.comment?.description?.split('\n')[0] ?? '',
      polarion: {
        isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence',
        title: `${model.module} ${scenario} 序列图`, workItemId: null,
      },
    } satisfies SequenceDesign);
  }

  return result;
}

export interface GenerateOptions {
  /** 只生成指定条目（函数名或 'dynamic'），空 = 全部 */
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
      log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${fn.name} — ${(err as Error).message.split('\n')[0]}`);
      opts?.failures?.push(`${fn.name}: ${(err as Error).message.split('\n')[0]}`);
    }
  }

  if ((!only || only.includes('dynamic'))) {
    if (skipExisting && model.dynamicDesign) {
      log('跳过（已有动态设计）');
    } else {
      log('生成动态设计（状态机/序列图）');
      try {
        model.dynamicDesign = await generateDynamicDesign(model, provider);
      } catch (err) {
        log(`  ⚠ 动态设计失败（已跳过，可 --resume 重试）: ${(err as Error).message.split('\n')[0]}`);
        opts?.failures?.push(`dynamic: ${(err as Error).message.split('\n')[0]}`);
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
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${macro.name} — ${(err as Error).message.split('\n')[0]}`);
        opts?.failures?.push(`${macro.name}: ${(err as Error).message.split('\n')[0]}`);
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
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${ext.name} — ${(err as Error).message.split('\n')[0]}`);
        opts?.failures?.push(`${ext.name}: ${(err as Error).message.split('\n')[0]}`);
      }
    }
  }

  return model;
}
