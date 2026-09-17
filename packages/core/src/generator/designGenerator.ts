import type {
  ModuleModel, FunctionUnit, DynamicDesign, StateMachineDesign, SequenceDesign, TypeUnit,
} from '../model/types.js';
import type { LLMProvider } from '../llm/provider.js';
import {
  buildFunctionDescriptionPrompt,
  buildStateMachinePrompt, buildSequencePrompt, buildConfigValueEffectPrompt,
  buildCalloutDescriptionPrompt, buildTypeDescriptionPrompt,
  buildExternalDescriptionPrompt, buildModuleDescriptionPrompt,
} from '../llm/prompts.js';
import { lintMermaidSource, lintFlowchartStructure, lintSequenceStructure } from '../report/mermaidPre.js';
import { buildStaticFlowchart, buildFallbackFlowchart } from './staticFlowchart.js';

/** 流程图断言网（纯函数，导出供静态生成器自检与测试直喂恶意图）：
 *  词法 lint + 结构 lint + 条件编译虚线框存在性 + 编译期宏禁入菱形；返回中文问题清单（空 = 通过） */
export function flowchartProblems(fn: FunctionUnit, text: string): string[] {
  const problems = [...lintMermaidSource(text), ...lintFlowchartStructure(text)];
  // 条件编译虚线框硬校验（v3 实测 Qwen 会整图漏画使能框，或把 #if 误画成运行时菱形）：
  for (const macro of [...new Set([...fn.conditionalFlags, ...(fn.innerCondFlags ?? [])])]) {
    const fcLines = text.split('\n');
    // ① 框存在性：宏名必须出现在注释节点标签（["..."] 行，排除 style/classDef/class 样式行）。
    //    只出现在菱形 {"..."} 里不算数——那是把编译期条件误画成运行时分支。
    //    注释里也接受两段式前缀缩写（GP_ECUSTPSHDN_SAFETY_ENABLE→SAFETY_ENABLE，基线既有风格）；
    //    缩写须仍含下划线（≥2 段），防 GP_X_ENABLE→ENABLE 这种单段缩写在任意注释里误命中。
    const abbrev = macro.replace(/^GP_[A-Za-z0-9]+_/, '');
    const names = abbrev.includes('_') ? [macro, abbrev] : [macro];
    const inNote = fcLines.some(l => l.includes('["') && !/^\s*(style|classDef|class)\s/.test(l) && names.some(n => l.includes(n)));
    if (!inNote) {
      problems.push(
        `缺少条件编译虚线框：宏 ${macro} 对应的代码段未圈出（应有注释节点写明「注：仅在 ${macro} 生效时参与编译」）`,
      );
    }
    // ② 编译期宏禁入菱形：宏在源码中仅出现于 #if/#elif、无运行时 if/for/while 使用时，
    //    菱形标签出现该宏 = 把编译期条件误画成运行时分支。菱形只表达运行时分支。
    //    运行时豁免依据 bodyTextWithPP（截断 8500，超长函数宏在截断外运行时使用会误报——
    //    误报表现为多一次重试进 failures，人工可辨，可接受）。
    const body = fn.bodyTextWithPP ?? fn.bodyText ?? '';
    const runtimeUse = body.split('\n').some(l => l.includes(macro) && /^\s*(?:if|for|while)\s*\(/.test(l));
    const inDiamond = fcLines.some(l => l.includes(macro) && l.includes('{"'));
    if (inDiamond && !runtimeUse) {
      problems.push(
        `宏 ${macro} 是编译期条件（源码中仅出现在 #if/#elif），不得画成菱形判断分支——菱形只用于源码中运行时 if/循环条件`,
      );
    }
  }
  return problems;
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

/** 术语表注入：外部缩写定义（abbreviationsDoc/JSON 节）按「在该 prompt 中实际出现」过滤后附到 user 末尾，
 *  让生成正文的术语口径与外部定义一致；不出现的条目不注入（防 prompt 膨胀稀释）。
 *  出现判定除整词 \bABBR\b 外，还认标识符分段——Spi_Setup/gpSpiChannel 里的 Spi 段也算 SPI 出现
 *  （嵌入式 C 的缩写多以标识符段形式存在；按段精确比对防 SPIN 误命中 SPI） */
function abbrAppears(abbr: string, text: string): boolean {
  const escA = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escA}\\b`, 'i').test(text)) return true;
  const target = abbr.toUpperCase();
  for (const w of text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    for (const seg of w.split(/_|(?<=[a-z])(?=[A-Z])/)) {
      if (seg.length > 0 && seg.toUpperCase() === target) return true;
    }
  }
  return false;
}

function withGlossary(user: string, abbr?: [string, string][]): string {
  if (!abbr || abbr.length === 0) return user;
  const hits = abbr.filter(([a]) => abbrAppears(a, user));
  if (hits.length === 0) return user;
  const lines = hits.map(([a, d]) => `- ${a} = ${d}`).join('\n');
  return `${user}\n\n# 项目术语表（以下缩写的定义以此外部口径为准；描述中涉及这些缩写时按其含义理解，正文保持缩写原形、不要自行展开或改写定义）\n${lines}`;
}

/** 图集输出校验：允许「### 角色名」分段的多张图（多核模块按角色分图），剥围栏/前言后整体返回 */
function extractDiagramSet(output: string, startLine: 'sequenceDiagram' | 'stateDiagram-v2'): string {
  let text = output.trim();
  const fence = text.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const lines = text.split('\n');
  const startIdx = lines.findIndex(l => l.trim().startsWith(startLine) || /^### .+/.test(l.trim()));
  if (startIdx > 0) text = lines.slice(startIdx).join('\n').trim();
  if (!new RegExp(`^(### .+\\n+)?${startLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) {
    throw new Error(`你的输出不是有效的 Mermaid 图代码。要求：第一行必须是 ${startLine}（多角色分图时每张图前一行写 ### 角色名），只输出图代码本身，不要输出任何解释、描述或分析文字。请重新输出。`);
  }
  return text;
}

/** 序列图输出校验：extractSequenceSet 提取 + 逐角色图词法 lint + 组合片段结构 lint；问题拼成中文反馈随重试回喂 */
function validateSequence(fn: FunctionUnit): (output: string) => string {
  // 平铺判定的可靠信号在函数源码而非图文本（TLF 实测：平铺图的消息全是裸函数名，无关键词可抓）——
  // 源码有分支/循环，图就该有组合片段；源码无控制流的函数不要求片段（防误报）
  const fnHasControlFlow = /\b(if|for|while|switch)\s*\(/.test(fn.bodyTextWithPP ?? fn.bodyText);
  return (output: string): string => {
    const text = extractDiagramSet(output, 'sequenceDiagram');
    const problems: string[] = [];
    let fragmentTotal = 0;
    for (const part of splitRoleDiagrams(text)) {
      fragmentTotal += (part.diagram.match(/^\s*(alt|opt|loop|par|critical|break)\b/gm) ?? []).length;
      for (const p of [...lintMermaidSource(part.diagram), ...lintSequenceStructure(part.diagram)]) {
        problems.push(part.role ? `【${part.role}图】${p}` : p);
      }
      // Callout 不得建参与者：Callout 是本模块留给集成方的接口函数，属本模块，参与者只建模块粒度。
      // 检测声明式（participant X as Callout / participant Callout）与隐式（消息端点恰为 Callout）两种；
      // 消息文本里的 CalloutXxx 函数名不算（自调用 M->>M: CalloutXxx() 是正确画法）。
      const dia = part.diagram;
      const declared = dia.split('\n').some(l => /^\s*participant\s+(\w+\s+as\s+)?Callout\s*$/i.test(l));
      const asEndpoint = dia.split('\n').some(l => {
        const m = l.match(/^\s*(\w+)\s*-{1,2}>>\s*(\w+)\s*:/);
        return !!m && (m[1] === 'Callout' || m[2] === 'Callout');
      });
      if (declared || asEndpoint) {
        problems.push(
          (part.role ? `【${part.role}图】` : '') +
          '不得把 Callout 列为参与者：Callout 是本模块的接口函数不是独立模块，参与者只建模块粒度。删除 Callout 参与者，调用 Callout 函数画成自调用（本模块->>本模块: CalloutXxx()）',
        );
      }
    }
    if (fnHasControlFlow && fragmentTotal === 0) {
      problems.push('函数源码含 if/for/while/switch 分支或循环，但序列图全图没有任何组合片段：对应的消息段必须用 alt [条件]/else、opt [条件]、loop [循环条件] 标注并以 end 结束，禁止把分支/循环平铺成普通消息');
    }
    if (problems.length > 0) {
      throw new Error(
        `你的序列图存在以下 ${problems.length} 个问题：\n` +
        problems.map((p, i) => `${i + 1}. ${p}`).join('\n') +
        '\n请修正后重新输出完整的图代码（仍然只输出图代码本身，多角色分图时保留 ### 角色名 行）。',
      );
    }
    return text;
  };
}

/** 把「### 角色名」分段的多张图拆成 {role, diagram} 列表（序列图/状态机共用）；无分段则单图 role=null */
function splitRoleDiagrams(text: string): { role: string | null; diagram: string }[] {
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

/** 状态机输出校验：允许「### 角色名」分段多图（多核模块按角色分图），每张都必须是完整 stateDiagram-v2 */
function validateStateMachine(): (output: string) => string {
  return (output: string) => {
    const text = extractDiagramSet(output, 'stateDiagram-v2');
    for (const part of splitRoleDiagrams(text)) {
      if (!part.diagram.trim().startsWith('stateDiagram-v2')) {
        throw new Error(`状态机分图「${part.role ?? '未标角色'}」缺少 stateDiagram-v2 起始行：多角色分图时每张图都必须是完整的状态机图（### 角色名 换行后第一行写 stateDiagram-v2）。请修正后重新输出完整的图代码。`);
      }
    }
    return text;
  };
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

/** 流程图生成结果（静态生成，永不抛错——一切异常收敛到 L3 顺序链兜底图） */
export interface FlowchartGenResult {
  warnings: string[];
  degraded: 'none' | 'subtree' | 'block';
  /** 断言网检出缺陷（CFG 生成器 bug 信号，应进 failures 让人工知晓；图已按 L3 兜底写出） */
  defect?: string;
}

/** 为单个函数生成流程图：tree-sitter CFG 静态构建（零 LLM，结构确定性）。
 *  断言网 flowchartProblems 自检；失败/异常一律降 L3 顺序链兜底——gen 对任意函数必出图 */
async function genFlowchart(
  fn: FunctionUnit,
  readSource: ((relPath: string) => string | null) | undefined,
): Promise<FlowchartGenResult> {
  let diagram: string;
  let warnings: string[] = [];
  let degraded: FlowchartGenResult['degraded'] = 'none';
  let defect: string | undefined;
  try {
    if (!readSource) throw new Error('无源码读取通道（readSource 未配置）');
    const source = readSource(fn.file);
    if (source == null) throw new Error(`源码文件读取失败: ${fn.file}`);
    const r = await buildStaticFlowchart(fn, source);
    diagram = r.mermaid;
    warnings = r.warnings;
    degraded = r.degraded;
    // 断言网只查实际画出框的宏：空区域（#if 只包花括号等片段）被构造性抑制，
    // 不应触发「缺少条件编译虚线框」误报把整个函数打进 L3（抑制本身已记 warnings）
    const fnView: FunctionUnit = r.framedMacros.length === (fn.innerCondFlags ?? []).length
      ? fn
      : { ...fn, innerCondFlags: (fn.innerCondFlags ?? []).filter(m => r.framedMacros.includes(m)) };
    const problems = flowchartProblems(fnView, diagram);
    if (problems.length > 0) throw new Error(`断言网检出 ${problems.length} 个问题: ${problems.join('；')}`);
  } catch (err) {
    defect = `CFG生成器缺陷（已降 L3 兜底）: ${(err as Error).message}`;
    degraded = 'block';
    diagram = buildFallbackFlowchart(fn);
    // 兜底图也过一遍断言网：L3 构造上应全绿，出问题说明是更深的生成器 bug
    const fbProblems = flowchartProblems(fn, diagram);
    if (fbProblems.length > 0) defect += `；L3 兜底图仍有 ${fbProblems.length} 个问题: ${fbProblems.join('；')}`;
  }
  fn.generated = fn.generated ?? {
    detailedDescription: '', llmModel: 'static-cfg', generatedAt: new Date().toISOString(),
  };
  fn.generated.flowchart = diagram;
  fn.generated.flowchartFormat = 'mermaid';
  return { warnings, degraded, defect };
}

/** 为单个函数生成增强描述（LLM）+ 流程图（静态） */
async function enrichFunction(
  model: ModuleModel,
  fn: FunctionUnit,
  provider: LLMProvider,
  abbr?: [string, string][],
  readSource?: (relPath: string) => string | null,
): Promise<FlowchartGenResult> {
  const { system, user } = buildFunctionDescriptionPrompt(model, fn);
  const text = await generateWithRetry(provider, system, withGlossary(user, abbr), (o) => {
    const cleaned = o.trim();
    if (cleaned.length < 20) throw new Error('描述过短（<20字符）');
    return cleaned;
  });
  fn.generated = {
    detailedDescription: text,
    llmModel: provider.name,
    generatedAt: new Date().toISOString(),
  };

  return genFlowchart(fn, readSource);
}

/** 生成动态设计（5.3 状态机 + 序列图）；skip 用于 --resume 时只补缺的一半 */
async function generateDynamicDesign(
  model: ModuleModel,
  provider: LLMProvider,
  skip?: { stateMachine?: boolean; sequences?: boolean },
): Promise<DynamicDesign> {
  const result: DynamicDesign = { stateMachine: null, sequences: [] };

  // ---- 状态机（多核模块按角色分图：### 主核 Core0 / ### 从核 satellite 各成一张工作项） ----
  const smPrompt = skip?.stateMachine ? null : buildStateMachinePrompt(model);
  if (smPrompt) {
    const text = await generateWithRetry(provider, smPrompt.system, smPrompt.user, validateStateMachine());
    const sms = splitRoleDiagrams(text).map((part): StateMachineDesign => {
      const name = part.role ? `${model.module} 状态机（${part.role}）` : `${model.module} 状态机`;
      return {
        name,
        diagram: part.diagram,
        diagramFormat: 'mermaid',
        states: smPrompt.states,
        transitions: [],
        polarion: {
          isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine',
          title: name, workItemId: null,
        },
      };
    });
    result.stateMachine = sms[0] ?? null;   // 兼容位：旧读取口径只看第一张
    if (sms.length > 1) result.stateMachines = sms;
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
    const text = await generateWithRetry(provider, system, user, validateSequence(fn), 3);
    // 多核模块按角色分图：### 主核 Core0 / ### 从核 satellite 各成一张工作项
    for (const part of splitRoleDiagrams(text)) {
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
  /** 外部缩写定义（lld.config.json 的 abbreviationsDoc/abbreviations 解析结果）——按 prompt 内实际出现
   *  过滤后注入文本类生成（描述/配置说明/类型注释/外部接口说明/5.1），术语口径与外部定义一致 */
  abbreviations?: [string, string][];
  /** 源文件读取通道（core 不碰 fs，由 CLI 注入）：流程图静态生成按 fn.file 重解析用。
   *  返回 null = 读不到（该函数降 L3 兜底图） */
  readSource?: (relPath: string) => string | null;
}

/** 生成入口：就地增强 model（函数 generated 字段 + dynamicDesign）。
 *  provider 可为 null——仅当只跑 --only flowcharts（纯静态生成）时允许 */
export async function generateDesign(
  model: ModuleModel,
  provider: LLMProvider | null,
  opts?: GenerateOptions,
): Promise<ModuleModel> {
  const log = opts?.onProgress ?? (() => {});
  const only = opts?.only;
  const skipExisting = opts?.skipExisting ?? false;

  // --only flowcharts：只重刷各函数的流程图，保留已生成的描述等其余内容；纯静态生成，无需 LLM
  if (only?.includes('flowcharts')) {
    const fnFilter = only.filter(o => o !== 'flowcharts');
    for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
      if (fnFilter.length > 0 && !fnFilter.includes(fn.name)) continue;
      log(`重新生成流程图: ${fn.name}`);
      try {
        const r = await genFlowchart(fn, opts?.readSource);
        for (const w of r.warnings) log(`  ⚠ ${fn.name}: ${w}`);
        if (r.degraded !== 'none') log(`  ⚠ ${fn.name}: 降级级别 ${r.degraded}`);
        if (r.defect) opts?.failures?.push(`${fn.name}: ${r.defect}`);
      } catch (err) {
        log(`  ⚠ 失败（已跳过，可 --resume 重试）: ${fn.name} — ${(err as Error).message.replace(/\n/g, '\n      ')}`);
        opts?.failures?.push(`${fn.name}: ${(err as Error).message.replace(/\n/g, '\n      ')}`);
      }
    }
    return model;
  }

  // 其余生成项均需 LLM
  if (!provider) throw new Error('生成描述/动态设计/配置说明等内容需要 LLM Provider（仅 --only flowcharts 可免 LLM）');

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
      const r = await enrichFunction(model, fn, provider, opts?.abbreviations, opts?.readSource);
      for (const w of r.warnings) log(`  ⚠ ${fn.name}: ${w}`);
      if (r.degraded !== 'none') log(`  ⚠ ${fn.name}: 流程图降级级别 ${r.degraded}`);
      if (r.defect) opts?.failures?.push(`${fn.name}: ${r.defect}`);
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
          stateMachines: keepSM ? existing!.stateMachines : fresh.stateMachines,
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
        const text = await generateWithRetry(provider, system, withGlossary(user, opts?.abbreviations), (o) => {
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
        const text = await generateWithRetry(provider, system, withGlossary(user, opts?.abbreviations), (o) => {
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
        const parsed = await generateWithRetry(provider, system, withGlossary(user, opts?.abbreviations), validateTypeDescription(t));
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
        const text = await generateWithRetry(provider, system, withGlossary(user, opts?.abbreviations), (o) => {
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
        const text = await generateWithRetry(provider, system, withGlossary(user, opts?.abbreviations), (o) => {
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
