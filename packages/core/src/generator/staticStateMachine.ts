/**
 * 确定性状态机生成（零 LLM）：stateMachineBuilder 提取迁移事实 → 本模块组装发射 mermaid。
 *
 * 降级阶梯（对齐 staticFlowchart 先例，任意模块必出图、永不抛错）：
 *   L0 完整 CFG 抽象解释（none）
 *   L1 角色检测失败/无差异 → 合并单图（none，正常路径）
 *   L2 部分函数 CFG 失败 → 该函数行级正则兜底（partial，触发=函数名:行号）
 *   L3 无任何迁移 → 状态清单图（list：[*]-->初态 + 各状态独立声明）
 *   无候选 → null（5.3.1 不出节，与旧 LLM 路径 prompt 返回 null 同语义）
 *
 * 发射硬约束（09-18 用户定调，构造性保证）：
 *   - 永不输出 note；补充信息只走迁移触发条件（代码原文）与状态内容行
 *   - 状态内容行格式 `X : X——执行 a()、b()`（mermaid 内容顶替状态名，必须把状态名抄在开头）
 *   - 单图不输出 ### 角色行；分图仅 主核 Core0 / 从核 satellite
 */
import { extractStateMachineFacts, fnRank, smInitialState, type SmBuildFacts } from '../analyzer/stateMachineBuilder.js';
import { buildSmLabelPolishPrompt } from '../llm/prompts.js';
import type { LLMProvider } from '../llm/provider.js';
import type { ModuleModel, StateMachineDesign } from '../model/types.js';

/** 从状态机图源解析迁移表（5.3.1.2）：X --> Y : 触发条件（含 [*] 伪状态，无标签时 trigger 为空串） */
export function parseSmTransitions(diagram: string): StateMachineDesign['transitions'] {
  const out: StateMachineDesign['transitions'] = [];
  for (const m of diagram.matchAll(/^\s*(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.+?))?\s*$/gm)) {
    out.push({ from: m[1], to: m[2], trigger: m[3]?.trim() ?? '', description: '' });
  }
  return out;
}

export interface StaticSmOutput {
  sms: StateMachineDesign[];
  warnings: string[];
  degraded: 'none' | 'partial' | 'list';
  /** 每张图的裸边上下文：`from->to` → 提示文本（发生在函数 X；目标状态内容调用），仅供 polishSmLabels 补标签，不持久化 */
  edgeCtx: Map<StateMachineDesign, Map<string, string>>;
}

const ANY_STATE_ID = 'ANY_STATE';
/** 初态边标签（09-21 对照 v6 手绘定调「上电复位」；润色层不碰） */
const INITIAL_LABEL = '上电复位';

/** 状态内容行：存续期间调用名原文（截断 4 个），无调用不出行 */
function contentLine(state: string, calls: string[]): string | null {
  if (calls.length === 0) return null;
  const shown = calls.slice(0, 4).map(c => `${c}()`);
  const more = calls.length > 4 ? `……等 ${calls.length} 项` : '';
  return `    ${state} : ${state}——执行 ${shown.join('、')}${more}`;
}

/** 发射一张图的迁移行：from 兜底（[*]/任意状态）、default 展开、去重、排序；
 *  顺带收集裸边（无标签迁移）的上下文 `from->to` → 函数名，供润色层补标签 */
function emitTransitions(facts: SmBuildFacts, roleFacts: SmBuildFacts['perRole'][number]): { lines: string[]; bareCtx: Map<string, string> } {
  const { candidate } = facts;
  const initial = smInitialState(candidate);
  const stateNames = new Set(candidate.states.map(s => s.name));

  // from 解析 + default 展开
  const resolved: { from: string; to: string; trigger: string; fn: string; rank: number; row: number; terminal: boolean }[] = [];
  for (const t of roleFacts.transitions) {
    const rank = fnRank(t.fn);
    const base = { to: t.to, trigger: t.trigger, fn: t.fn, rank, row: t.row, terminal: !!t.terminal };
    if (t.from === '__default__') {
      // switch default 分支：从「属于本状态变量但未被 case 覆盖」的状态各出一条。
      // 归属判定 = 出现过为赋值目标或 case 标签（排除宏族里属于其他变量的取值，如 TLF 的 NORMAL_STATE）
      const belongs = new Set([...roleFacts.caseStates]);
      for (const x of roleFacts.transitions) if (x.to !== '[*]') belongs.add(x.to);
      const uncovered = candidate.states.map(s => s.name).filter(n => belongs.has(n) && !roleFacts.caseStates.has(n));
      for (const u of uncovered) resolved.push({ ...base, from: u });
    } else if (t.from === null) {
      resolved.push({ ...base, from: rank <= 2 ? (initial ?? '[*]') : ANY_STATE_ID });
    } else {
      resolved.push({ ...base, from: t.from });
    }
  }

  // 排序：函数性质（PreInit→Init→Startup→MainFunction→其他）→ 行号
  resolved.sort((a, b) => a.rank - b.rank || a.row - b.row);

  // 去重（同 from/to/trigger）
  const seen = new Set<string>();
  const lines: string[] = [];
  const bareCtx = new Map<string, string>();
  let anyUsed = false;
  for (const t of resolved) {
    if (t.to !== '[*]' && !stateNames.has(t.to)) continue; // 目标不在候选集（不应发生，断言网前置）
    const key = `${t.from}->${t.to}:${t.trigger}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (t.from === ANY_STATE_ID) anyUsed = true;
    if (!t.trigger && t.to !== '[*]' && !bareCtx.has(`${t.from}->${t.to}`)) {
      bareCtx.set(`${t.from}->${t.to}`, t.fn);
    }
    lines.push(`    ${t.from} --> ${t.to}${t.trigger ? ` : ${t.trigger}` : ''}`);
  }

  const head: string[] = [];
  if (initial && !seen.has(`[*]->${initial}`) && ![...seen].some(k => k.startsWith('[*]->'))) {
    head.push(`    [*] --> ${initial} : ${INITIAL_LABEL}`);
  }
  const tail: string[] = [];
  if (anyUsed) tail.push(`    state "任意状态" as ${ANY_STATE_ID}`);
  return { lines: [...head, ...lines, ...tail], bareCtx };
}

/** L3 状态清单图：无任何迁移事实时的兜底 */
function emitListDiagram(facts: SmBuildFacts): string {
  const { candidate } = facts;
  const initial = smInitialState(candidate) ?? candidate.states[0]?.name;
  const lines = ['stateDiagram-v2'];
  if (initial) lines.push(`    [*] --> ${initial} : ${INITIAL_LABEL}`);
  for (const s of candidate.states) {
    if (s.name !== initial) lines.push(`    ${s.name}`);
  }
  return lines.join('\n');
}

/** 内置轻校验网（替代 LLM 时代的 validateStateMachine）：构造性约束的运行时复核 */
function sanityCheck(diagram: string, facts: SmBuildFacts): string | null {
  if (!diagram.startsWith('stateDiagram-v2')) return '缺 stateDiagram-v2 起始行';
  if (/^\s*note\s/m.test(diagram)) return '出现 note（构造上不应发生）';
  const stateNames = new Set([...facts.candidate.states.map(s => s.name), ANY_STATE_ID]);
  const parsed = parseSmTransitions(diagram);
  for (const t of parsed) {
    for (const end of [t.from, t.to]) {
      if (end !== '[*]' && !stateNames.has(end)) return `迁移端点 ${end} 不在候选状态集`;
    }
  }
  const emittedCount = (diagram.match(/^\s*(?:\[\*\]|\w+)\s*-->/gm) ?? []).length;
  if (parsed.length !== emittedCount) return `迁移行解析数不符（emit ${emittedCount} / parse ${parsed.length}）`;
  return null;
}

/** 组装入口：model → StateMachineDesign[]（多核分图时 主核/从核 两张）。永不抛错；无候选返回 null */
export async function buildStaticStateMachine(
  model: ModuleModel,
  readSource?: (relPath: string) => string | null,
): Promise<StaticSmOutput | null> {
  const facts = await extractStateMachineFacts(model, readSource);
  if (!facts) return null;
  const warnings = [...facts.warnings];
  const states = facts.candidate.states.map(s => ({ name: s.full, description: s.description }));

  const polarion = (name: string): StateMachineDesign['polarion'] => ({
    isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine', title: name, workItemId: null,
  });

  const sms: StateMachineDesign[] = [];
  const edgeCtx = new Map<StateMachineDesign, Map<string, string>>();
  let degraded: StaticSmOutput['degraded'] = facts.partial ? 'partial' : 'none';

  // 驱动函数缺失/字段定位失败时 perRole 为空：仍出 L3 状态清单图（必出图契约）
  const roleList: SmBuildFacts['perRole'] = facts.perRole.length > 0
    ? facts.perRole
    : [{ role: null, transitions: [], stateCalls: new Map(), caseStates: new Set() }];

  for (const roleFacts of roleList) {
    const roleLabel = roleFacts.role === 'master' ? '主核 Core0' : roleFacts.role === 'satellite' ? '从核 satellite' : null;
    const name = roleLabel ? `${model.module} 状态机（${roleLabel}）` : `${model.module} 状态机`;

    let diagram: string;
    let pendingCtx: Map<string, string> | null = null;
    if (roleFacts.transitions.length === 0) {
      // L3：状态清单图
      diagram = emitListDiagram(facts);
      degraded = 'list';
      warnings.push(`${name}: 未提取到迁移，降级为状态清单图`);
    } else {
      const { lines: tLines, bareCtx } = emitTransitions(facts, roleFacts);
      const lines = ['stateDiagram-v2', ...tLines];
      // 裸边上下文：函数名 + 目标状态内容调用（润色层补标签的素材，全部源自代码事实）
      const ctx = new Map<string, string>();
      for (const [edge, fn] of bareCtx) {
        const to = edge.split('->')[1];
        const calls = (roleFacts.stateCalls.get(to) ?? []).slice(0, 3).map(c => `${c}()`).join('、');
        ctx.set(edge, `发生在函数 ${fn}${calls ? `；${to} 状态内容：${calls}` : ''}`);
      }
      // 状态内容行（按候选状态顺序，[*]/ANY 不出内容行）
      for (const s of facts.candidate.states) {
        const cl = contentLine(s.name, roleFacts.stateCalls.get(s.name) ?? []);
        if (cl) lines.push(cl);
      }
      diagram = lines.join('\n');
      const problem = sanityCheck(diagram, facts);
      if (problem) {
        warnings.push(`${name}: 校验网检出「${problem}」，降级为状态清单图`);
        diagram = emitListDiagram(facts);
        degraded = 'list';
      } else if (ctx.size > 0) {
        pendingCtx = ctx;
      }
    }

    const sm: StateMachineDesign = {
      name, diagram, diagramFormat: 'mermaid', states,
      transitions: parseSmTransitions(diagram),
      polarion: polarion(name),
    };
    sms.push(sm);
    if (pendingCtx) edgeCtx.set(sm, pendingCtx);
    pendingCtx = null;
  }

  return { sms, warnings, degraded, edgeCtx };
}

/**
 * LLM 润色迁移标签+状态内容（09-20 用户定调「结构确定+LLM 只润色标签」）：
 * 图的骨架与迁移集合是确定性提取的零幻觉产物，本函数只把边上的机械标签
 * （条件表达式原文/英文注释）与状态内容行（`X : X——执行 a()、b()` 的函数列表部分）
 * 换成 LLM 润色的中文短句，随后重解析迁移表；无标签的裸边也按 v6 手绘风格补一句
 * 动作描述（上下文=函数名+目标状态内容调用，全部源自代码事实，不发明结构）。
 * 内容行的 `X : X——` 前缀构造性保留
 * （09-18 内嵌状态名定调，mermaid 会用内容顶掉状态名显示）。
 * 任何一步失败都保持原文，返回告警字符串；成功或无可润色返回 null。绝不抛错。
 * 防线：逐条校验（非空/超长/无换行/无 mermaid 语法符）+ 润色前后迁移行数一致。
 */
export async function polishSmLabels(
  sm: StateMachineDesign,
  module: string,
  provider: LLMProvider,
  edgeCtx?: Map<string, string>,
): Promise<string | null> {
  const parsed0 = parseSmTransitions(sm.diagram);
  const triggers = [...new Set(
    parsed0.map(t => t.trigger).filter(t => t && t !== INITIAL_LABEL && t !== '复位初值'),
  )];
  // 裸边（无标签迁移）：对照 v6 手绘风格由 LLM 补一句动作描述，上下文取自代码事实
  // （函数名+目标状态内容调用，由 buildStaticStateMachine 提供）；无上下文时只给 from/to
  const bareKeys = [...new Set(
    parsed0.filter(t => !t.trigger && t.to !== '[*]').map(t => `${t.from}->${t.to}`),
  )];
  const bares = bareKeys.map(edge => {
    const [from, to] = edge.split('->');
    const ctx = edgeCtx?.get(edge);
    return `从 ${from} 迁移到 ${to}（无守护条件${ctx ? `，${ctx}` : ''}）`;
  });
  // 状态内容行：`    X : X——执行 a()、b()……等 N 项`，润色目标=「——」后的部分
  const contentRe = /^\s*(\w+) : \1——(.+?)\s*$/;
  const contents = [...new Set(
    sm.diagram.split('\n').map(l => l.match(contentRe)?.[2]).filter((c): c is string => !!c),
  )];
  if (triggers.length === 0 && contents.length === 0 && bares.length === 0) return null;
  const role = sm.name.includes('主核') ? 'master' as const
    : sm.name.includes('从核') ? 'satellite' as const : null;
  const { system, user } = buildSmLabelPolishPrompt(triggers, contents, module, role, bares);

  let text: string;
  try {
    text = await provider.generate(system, user, { temperature: 0 });
  } catch (err) {
    return `润色请求失败（${(err as Error).message}），保持原文`;
  }
  const jsonPart = text.match(/\{[\s\S]*\}/);
  if (!jsonPart) return '润色响应无 JSON，保持原文';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonPart[0]);
  } catch {
    return '润色响应 JSON 解析失败，保持原文';
  }

  const sanitize = (v: unknown, orig: string, maxLen: number): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.replace(/\s+/g, ' ').trim();
    if (!s || s === orig || s.length > maxLen) return null;
    if (/-->|\[\*\]|:::|^\s*note\b/i.test(s)) return null; // mermaid 注入防护
    return s;
  };
  const trigMap = new Map<string, string>();
  for (const [i, label] of triggers.entries()) {
    const s = sanitize(parsed[String(i + 1)], label, 60);
    if (s) trigMap.set(label, s);
  }
  const bareMap = new Map<string, string>();
  for (const [i, b] of bares.entries()) {
    const s = sanitize(parsed[`U${i + 1}`], b, 60);
    if (s) bareMap.set(bareKeys[i], s);
  }
  const contMap = new Map<string, string>();
  for (const [i, c] of contents.entries()) {
    const s = sanitize(parsed[`C${i + 1}`], c, 100);
    if (s) contMap.set(c, s);
  }
  if (trigMap.size === 0 && contMap.size === 0 && bareMap.size === 0) return null;

  // 逐行整标签替换（锚定行尾，不存在子串误伤）；替换后迁移行数必须不变
  const before = parseSmTransitions(sm.diagram).length;
  const lines = sm.diagram.split('\n').map(line => {
    const tm = line.match(/^(\s*(?:\[\*\]|\w+)\s*-->\s*(?:\[\*\]|\w+)\s*:\s*)(.+?)\s*$/);
    if (tm) {
      const nu = trigMap.get(tm[2]);
      return nu ? tm[1] + nu : line;
    }
    const bm = line.match(/^(\s*)((?:\[\*\]|\w+)\s*-->\s*(?:\[\*\]|\w+))\s*$/);
    if (bm) {
      const key = bm[2].replace(/\s*-->\s*/, '->');
      const nu = bareMap.get(key);
      return nu ? `${bm[1]}${bm[2]} : ${nu}` : line;
    }
    const cm = line.match(contentRe);
    if (cm) {
      const nu = contMap.get(cm[2]);
      if (nu) return `${line.match(/^\s*/)![0]}${cm[1]} : ${cm[1]}——${nu}`;
    }
    return line;
  });
  const diagram = lines.join('\n');
  if (parseSmTransitions(diagram).length !== before) return '润色后迁移行数变化，放弃润色保持原文';
  sm.diagram = diagram;
  sm.transitions = parseSmTransitions(diagram);
  return null;
}
