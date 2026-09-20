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
}

const ANY_STATE_ID = 'ANY_STATE';

/** 状态内容行：存续期间调用名原文（截断 4 个），无调用不出行 */
function contentLine(state: string, calls: string[]): string | null {
  if (calls.length === 0) return null;
  const shown = calls.slice(0, 4).map(c => `${c}()`);
  const more = calls.length > 4 ? `……等 ${calls.length} 项` : '';
  return `    ${state} : ${state}——执行 ${shown.join('、')}${more}`;
}

/** 发射一张图的迁移行：from 兜底（[*]/任意状态）、default 展开、去重、排序 */
function emitTransitions(facts: SmBuildFacts, roleFacts: SmBuildFacts['perRole'][number]): string[] {
  const { candidate } = facts;
  const initial = smInitialState(candidate);
  const stateNames = new Set(candidate.states.map(s => s.name));

  // from 解析 + default 展开
  const resolved: { from: string; to: string; trigger: string; rank: number; row: number; terminal: boolean }[] = [];
  for (const t of roleFacts.transitions) {
    const rank = fnRank(t.fn);
    const base = { to: t.to, trigger: t.trigger, rank, row: t.row, terminal: !!t.terminal };
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
  let anyUsed = false;
  for (const t of resolved) {
    if (t.to !== '[*]' && !stateNames.has(t.to)) continue; // 目标不在候选集（不应发生，断言网前置）
    const key = `${t.from}->${t.to}:${t.trigger}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (t.from === ANY_STATE_ID) anyUsed = true;
    lines.push(`    ${t.from} --> ${t.to}${t.trigger ? ` : ${t.trigger}` : ''}`);
  }

  const head: string[] = [];
  if (initial && !seen.has(`[*]->${initial}`) && ![...seen].some(k => k.startsWith('[*]->'))) {
    head.push(`    [*] --> ${initial} : 复位初值`);
  }
  const tail: string[] = [];
  if (anyUsed) tail.push(`    state "任意状态" as ${ANY_STATE_ID}`);
  return [...head, ...lines, ...tail];
}

/** L3 状态清单图：无任何迁移事实时的兜底 */
function emitListDiagram(facts: SmBuildFacts): string {
  const { candidate } = facts;
  const initial = smInitialState(candidate) ?? candidate.states[0]?.name;
  const lines = ['stateDiagram-v2'];
  if (initial) lines.push(`    [*] --> ${initial} : 复位初值`);
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
  let degraded: StaticSmOutput['degraded'] = facts.partial ? 'partial' : 'none';

  // 驱动函数缺失/字段定位失败时 perRole 为空：仍出 L3 状态清单图（必出图契约）
  const roleList: SmBuildFacts['perRole'] = facts.perRole.length > 0
    ? facts.perRole
    : [{ role: null, transitions: [], stateCalls: new Map(), caseStates: new Set() }];

  for (const roleFacts of roleList) {
    const roleLabel = roleFacts.role === 'master' ? '主核 Core0' : roleFacts.role === 'satellite' ? '从核 satellite' : null;
    const name = roleLabel ? `${model.module} 状态机（${roleLabel}）` : `${model.module} 状态机`;

    let diagram: string;
    if (roleFacts.transitions.length === 0) {
      // L3：状态清单图
      diagram = emitListDiagram(facts);
      degraded = 'list';
      warnings.push(`${name}: 未提取到迁移，降级为状态清单图`);
    } else {
      const lines = ['stateDiagram-v2', ...emitTransitions(facts, roleFacts)];
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
      }
    }

    sms.push({
      name, diagram, diagramFormat: 'mermaid', states,
      transitions: parseSmTransitions(diagram),
      polarion: polarion(name),
    });
  }

  return { sms, warnings, degraded };
}
