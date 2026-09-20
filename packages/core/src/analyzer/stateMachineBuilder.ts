/**
 * 确定性状态机提取（零 LLM）：从源码机械提取状态集合与迁移事实。
 *
 * 两条候选路径（与旧 prompts.ts 的 LLM prompt 候选检测同源演化）：
 *   ① typedef + relatedDefines≥3（如 Gp_EcuStpShdn_StpStageType）
 *   ② 宏族 <前缀>_<名>_(STATE|MODE|STAGE)（如 GP_TLF35584_*_STATE）
 *
 * 迁移提取做在 cfgBuilder 的 CFG 上（cond 标签=条件原文、if 是/否边、
 * switch case 边、空体 while 自旋 spinOf 结构均为既有契约），抽象解释携带
 * 「当前状态」沿路径传播：赋值=迁移、case/守护=迁移源提示、自旋退出=迁移、
 * PwrShdn/SafeState 类调用=到 [*] 的提前终止。
 */
import { preprocessSource, parseCFile } from '../parser/cParser.js';
import { buildFnCfg, type Cfg } from '../analyzer/cfgBuilder.js';
import type { FunctionUnit, ModuleModel } from '../model/types.js';

/** 状态定义（短名=去公共前后缀，如 GP_ECUSTPSHDN_STPSTAGE_TWO → TWO） */
export interface SmStateDef {
  full: string;        // 宏全名
  name: string;        // 短名（图内状态 id）
  value: string;       // 宏值（宏族路径可能为空串）
  description: string; // define 注释
}

export interface SmCandidate {
  states: SmStateDef[];
  /** 状态变量字段名（如 StpStage_t / StateVar_u8），定位不到为 null（仅宏族且有赋值可推断） */
  field: string | null;
  typedefName?: string;
}

export interface SmTransitionFact {
  /** 迁移源短名；null=未能确定（发射层按函数性质兜底为 [*]/任意状态）；'__default__'=switch default 分支待展开 */
  from: string | null;
  to: string;          // 目标短名；'[*]'=提前终止
  trigger: string;     // 守护条件原文（&& 连接）或构造短语；空串=无标签
  fn: string;
  row: number;         // 0-based clean 行号（排序用）
  terminal?: boolean;
}

export interface SmFnFacts {
  transitions: SmTransitionFact[];
  /** 状态短名 → 该状态存续期间的调用名（状态内容行素材），按出现顺序去重 */
  stateCalls: Map<string, string[]>;
  /** 本函数是否含角色分支（GetCoreId 返回值变量的比较） */
  roleCondFound: boolean;
  /** 本函数 switch(状态变量) 覆盖的 case 状态集合（default 展开用） */
  caseStates: Set<string>;
}

const FAMILY_RE = /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)*?)_([A-Z0-9]+)_(STATE|MODE|STAGE)\b/g;
const TERMINAL_CALL_RE = /\b\w*(?:PwrShdn|SafeState)\w*\s*\(/;
const COREID_ASSIGN_RE = /(\b\w+)\s*=\s*[\w\s\->.]*?GetCoreId\w*\s*\(/;

/** 最长公共前缀/后缀（整段下划线分隔对齐，短名剥离用） */
function commonAffix(names: string[]): { prefix: string; suffix: string } {
  if (names.length === 0) return { prefix: '', suffix: '' };
  let prefix = names[0];
  for (const n of names) {
    while (!n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  prefix = prefix.slice(0, prefix.lastIndexOf('_') + 1);
  let suffix = names[0];
  for (const n of names) {
    while (!n.endsWith(suffix)) suffix = suffix.slice(1);
  }
  const us = suffix.lastIndexOf('_');
  suffix = us >= 0 ? suffix.slice(us) : '';
  // 前后缀合计不能把名字剥空
  if (prefix.length + suffix.length >= Math.min(...names.map(n => n.length))) {
    return { prefix, suffix: '' };
  }
  return { prefix, suffix };
}

/** typedef 路径：struct elements 里找 type==typedefName 的字段名 */
function findFieldForTypedef(model: ModuleModel, typedefName: string): string | null {
  const fields: string[] = [];
  for (const t of model.types) {
    if (t.kind !== 'struct') continue;
    for (const e of t.elements ?? []) {
      if (e.type === typedefName || e.type.endsWith(` ${typedefName}`)) fields.push(e.name);
    }
  }
  if (fields.length === 0) return null;
  // 多字段时取函数体内被引用最多的
  const bodies = [...model.providedFunctions, ...model.internalFunctions].map(f => f.bodyText ?? '');
  fields.sort((a, b) => countRefs(bodies, b) - countRefs(bodies, a));
  return fields[0];
}

function countRefs(bodies: string[], name: string): number {
  const re = new RegExp(`\\b${name}\\b`, 'g');
  return bodies.reduce((n, b) => n + (b.match(re)?.length ?? 0), 0);
}

/** 宏族路径：从赋值 LHS 推断状态字段（`…->StateVar_u8 = GP_..._STATE` 取末段标识符） */
function inferFieldFromAssignments(model: ModuleModel, macroAlt: string): string | null {
  const re = new RegExp(`([\\w\\s\\->.\\[\\]]+?)=\\s*(?:${macroAlt})\\b`, 'g');
  const counts = new Map<string, number>();
  for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
    for (const m of (fn.bodyText ?? '').matchAll(re)) {
      const lhs = m[1].match(/(\w+)\s*$/)?.[1];
      if (lhs) counts.set(lhs, (counts.get(lhs) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * 状态机候选检测：typedef relatedDefines≥3（取声明序第一个，与旧 LLM prompt 同口径——
 * EcuStp 的 StpStageType 先于 SelfTestType、IoM 的 InitStuType 先于 IfIdType，声明序即主状态机）；
 * 无 typedef 时退化宏族 *_STATE|_MODE|_STAGE 聚类。返回 null = 模块无状态机（5.3.1 不出节）。
 */
export function findSmCandidate(model: ModuleModel): SmCandidate | null {
  // typedef 路径：声明序第一个（三模块实测口径）
  const stateType = model.types.find(t => t.kind === 'typedef' && (t.relatedDefines?.length ?? 0) >= 3);
  if (stateType) {
    const defines = stateType.relatedDefines!;
    const alt = defines.map(d => d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const field = findFieldForTypedef(model, stateType.name) ?? inferFieldFromAssignments(model, alt);
    const { prefix, suffix } = commonAffix(defines.map(d => d.name));
    return {
      states: defines.map(d => ({
        full: d.name, name: d.name.slice(prefix.length, d.name.length - suffix.length) || d.name,
        value: d.value, description: d.comment ?? '',
      })),
      field, typedefName: stateType.name,
    };
  }

  // 宏族路径（无 typedef 关联宏的模块，如 TLF35584）：按后缀（STATE/MODE/STAGE）聚类，
  // 簇内取段对齐公共前缀——不能用单条正则的捕获组拼族键（GP_TLF_INITIAL_TASK_STATE
  // 会被拆成 GP_TLF_INITIAL_*_STATE 一族而掉队）
  const bySuffix = new Map<string, Set<string>>();
  for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
    for (const m of (fn.bodyText ?? '').matchAll(FAMILY_RE)) {
      if (!bySuffix.has(m[3])) bySuffix.set(m[3], new Set());
      bySuffix.get(m[3])!.add(m[0]);
    }
  }
  const families = [...bySuffix.values()]
    .filter(s => s.size >= 3)
    .map(s => ({ names: [...s].sort(), prefix: commonAffix([...s]).prefix }))
    .filter(f => (f.prefix.match(/_/g) ?? []).length >= 2); // 公共前缀不足两段 = 家族太散，弃
  const best = families.sort((a, b) => b.names.length - a.names.length)[0];
  if (!best) return null;
  const fulls = best.names;
  const alt = fulls.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const field = inferFieldFromAssignments(model, alt);
  const { prefix, suffix } = commonAffix(fulls);
  return {
    states: fulls.map(f => ({ full: f, name: f.slice(prefix.length, f.length - suffix.length) || f, value: '', description: '' })),
    field,
  };
}

/** 函数定位（与 buildStaticFlowchart 同策略：名字+行号双匹配，退化名字唯一） */
async function locateFnCfg(fn: FunctionUnit, source: string): Promise<Cfg> {
  const pre = preprocessSource(source);
  const parsed = await parseCFile(pre.clean);
  type TSNode = import('web-tree-sitter').SyntaxNode;
  const candidates: TSNode[] = [];
  (function walk(n: TSNode): void {
    if (n.type === 'function_definition') candidates.push(n);
    for (const c of n.namedChildren) walk(c);
  })(parsed.tree.rootNode);
  const nameOf = (n: TSNode): string => {
    const d = n.childForFieldName('declarator');
    return d ? pre.clean.slice(d.startIndex, d.endIndex) : '';
  };
  const byNameAndLine = candidates.filter(n => nameOf(n).includes(fn.name) && n.startPosition.row + 1 === fn.lineStart);
  const byName = candidates.filter(n => nameOf(n).includes(fn.name));
  const fnNode = byNameAndLine[0] ?? (byName.length === 1 ? byName[0] : null);
  if (!fnNode) throw new Error(`源码中定位不到函数 ${fn.name}（${fn.file}:${fn.lineStart}）`);
  const body = fnNode.childForFieldName('body');
  if (!body) throw new Error(`函数 ${fn.name} 无函数体节点`);
  return buildFnCfg(body, pre.clean, {
    condRegions: pre.condRegions,
    originalLines: pre.originalLines,
    fnRowFrom: fnNode.startPosition.row,
    fnRowTo: fnNode.endPosition.row,
  });
}

interface WalkCtx {
  field: string | null;
  /** 宏全名 → 短名 */
  shortOf: Map<string, string>;
  macroAlt: string;
  role: 'master' | 'satellite' | null;
  coreIdVars: string[];
  fnName: string;
  /** init 类函数入口携带的当前状态（非 init 类为 null → 迁移源兜底「任意状态」） */
  entryCurrent: string | null;
  /** 族公共前后缀（隐式状态识别用：赋给状态字段的同前缀裸宏也算状态，如 TLF 的 GP_TLF35584_INITIAL_TASK） */
  prefix: string;
  suffix: string;
  /** 解释中发现的隐式状态（全名 → 短名），由调用方并入候选 */
  implicit: Map<string, string>;
}

const CALL_FILTER_RE = /^(if|while|for|switch|return|sizeof|sizeof\(.*\)|.*NOP.*|.*GetCoreId.*)$/;

/** CFG 抽象解释：携带 current 状态沿路径传播，提取迁移/自旋/提前终止/状态内容调用 */
function interpretCfg(cfg: Cfg, ctx: WalkCtx): SmFnFacts {
  const { field, shortOf, macroAlt, role, coreIdVars, fnName } = ctx;
  const facts: SmFnFacts = { transitions: [], stateCalls: new Map(), roleCondFound: false, caseStates: new Set() };
  if (!field) return facts;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** 赋值 RHS 解析为状态短名：候选宏直接查表；同前缀裸宏登记为隐式状态 */
  const resolveState = (rhs: string): string | null => {
    const known = shortOf.get(rhs);
    if (known) return known;
    if (ctx.prefix && rhs.startsWith(ctx.prefix) && /^[A-Z0-9_]+$/.test(rhs)) {
      const stripped = rhs.slice(ctx.prefix.length,
        ctx.suffix && rhs.endsWith(ctx.suffix) ? rhs.length - ctx.suffix.length : undefined);
      const short = stripped || rhs;
      ctx.implicit.set(rhs, short);
      shortOf.set(rhs, short);
      return short;
    }
    return null;
  };
  const rhsRe = `(?:${macroAlt}${ctx.prefix ? `|${esc(ctx.prefix)}[A-Z0-9]+(?:_[A-Z0-9]+)*` : ''})`;
  const assignRe = new RegExp(`\\b${esc(field)}\\b[^;=]*?(?<![=!<>])=\\s*(${rhsRe})\\b`);
  const cmpRe = new RegExp(`\\b${esc(field)}\\s*(==|!=)\\s*(${macroAlt})\\b|(${macroAlt})\\s*(==|!=)\\s*${esc(field)}\\b`);
  const spinRe = new RegExp(`\\b${esc(field)}\\s*!=\\s*(${macroAlt})\\b|(${macroAlt})\\s*!=\\s*${esc(field)}\\b`);
  const switchRe = new RegExp(`^switch \\(.*\\b${esc(field)}\\b`);

  // 回边（from>to）指向的 cond = 循环条件（自旋检测用）
  const loopConds = new Set<number>();
  for (const e of cfg.edges) if (e.from > e.to) loopConds.add(e.to);
  const outEdges = new Map<number, typeof cfg.edges>();
  for (const e of cfg.edges) {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  }
  const nodeOf = (seq: number) => cfg.nodes[seq];

  /** 角色分支判定：返回 master 应走的边标签（是/否），null=非角色分支。
   *  变量必须紧邻比较符（`var == X` / `X == var`）——IoM 式 `HwInit(core) == E_OK`
   *  把 GetCoreId 返回值当索引用，不得误判为角色分支 */
  function roleEdgeFor(label: string): '是' | '否' | null {
    const v = coreIdVars.find(vv =>
      new RegExp(`\\b${esc(vv)}\\s*(==|!=)`).test(label) || new RegExp(`(==|!=)\\s*${esc(vv)}\\b`).test(label));
    if (!v) return null;
    // CoreId == CORE0_ID / == 0U → 是=master；!= 则否=master
    const masterConst = /(\w*CORE0\w*|\b0U?\b)/;
    const eq = /==/.test(label);
    const cmpWithMaster = masterConst.test(label);
    if (!cmpWithMaster) return '是'; // 形如 CoreId == x（非0）：默认是=master
    return eq ? '是' : '否';
  }

  function pushCalls(state: string, calls: string[]): void {
    if (calls.length === 0) return;
    const arr = facts.stateCalls.get(state) ?? [];
    for (const c of calls) if (!arr.includes(c)) arr.push(c);
    facts.stateCalls.set(state, arr);
  }

  interface Walk { seq: number; current: string | null; caseHint: string | null; triggers: string[]; calls: string[] }
  const stack: Walk[] = [{ seq: cfg.startSeq, current: ctx.entryCurrent, caseHint: null, triggers: [], calls: [] }];
  const visited = new Set<string>();
  let steps = 0;

  while (stack.length > 0 && steps++ < 20000) {
    const w = stack.pop()!;
    const key = `${w.seq}|${w.current}|${w.caseHint}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const node = nodeOf(w.seq);
    if (!node || node.dead) continue;
    const label = node.label.trim();

    const follow = (edgeLabelFilter: (e: { label?: string; noArrow?: boolean }) => boolean, mutate: (nw: Walk, e: { label?: string }) => void) => {
      for (const e of outEdges.get(w.seq) ?? []) {
        if (e.noArrow) continue; // 回边无箭头标记：visited 键已保证终止，不再走以免触发条件重复累积
        if (!edgeLabelFilter(e)) continue;
        const nw: Walk = { seq: e.to, current: w.current, caseHint: w.caseHint, triggers: [...w.triggers], calls: [...w.calls] };
        mutate(nw, e);
        stack.push(nw);
      }
    };

    switch (node.kind) {
      case 'start':
      case 'merge':
        follow(() => true, () => {});
        break;

      case 'end':
        if (w.current) pushCalls(w.current, w.calls);
        break;

      case 'cond': {
        // ① 角色分支：按角色剪枝
        const roleEdge = roleEdgeFor(label);
        if (roleEdge) {
          facts.roleCondFound = true;
          const masterEdge = roleEdge;
          const want = role === null ? null : (role === 'master' ? masterEdge : (masterEdge === '是' ? '否' : '是'));
          follow(e => want === null ? (e.label === '是' || e.label === '否') : e.label === want, () => {});
          break;
        }
        // ② 自旋等待（循环条件 + 纯 `状态 != 宏`）：否边退出即迁移
        const spin = label.match(spinRe);
        if (spin && loopConds.has(w.seq)) {
          const macro = spin[1] ?? spin[2];
          const to = shortOf.get(macro)!;
          const from = w.caseHint ?? w.current;
          facts.transitions.push({
            from, to, trigger: `${field} == ${macro}（自旋等待退出）`,
            fn: fnName, row: node.rowFrom,
          });
          if (from) pushCalls(from, w.calls);
          follow(e => e.label === '否', nw => { nw.current = to; nw.triggers = []; nw.calls = []; nw.caseHint = null; });
          break;
        }
        // ③ switch(状态变量)：case 边提供迁移源提示
        if (switchRe.test(label)) {
          follow(() => true, (nw, e) => {
            const m = e.label?.match(/^case\s+(\w+)$/);
            if (m && shortOf.has(m[1])) {
              nw.caseHint = shortOf.get(m[1])!;
              facts.caseStates.add(nw.caseHint);
            } else if (e.label === 'default') {
              nw.caseHint = '__default__';
            }
          });
          break;
        }
        // ④ 状态比较守护（if 状态==宏）：是边给迁移源提示，不进触发条件（与迁移源冗余）
        const cmp = label.match(cmpRe);
        if (cmp) {
          const macro = cmp[2] ?? cmp[3];
          const op = cmp[1] ?? cmp[4];
          const short = shortOf.get(macro);
          follow(() => true, (nw, e) => {
            const positive = (e.label === '是') === (op === '==');
            if (positive && short) nw.caseHint = short;
          });
          break;
        }
        // ⑤ 一般条件：是边累积原文、否边累积 !(原文)、case 边累积 case 标签。
        // 循环条件的 是/否 边不累积——for/while 的退出条件是迭代语义不是迁移守护，
        // 否则首条赋值会把前面所有 for 循环的 !(Cnt<NUM) 噪声挂成触发条件（E2E 实测）
        const isLoopCond = loopConds.has(w.seq);
        follow(() => true, (nw, e) => {
          if (isLoopCond) return;
          if (e.label === '是') nw.triggers.push(label);
          else if (e.label === '否') nw.triggers.push(`!(${label})`);
          else if (e.label && e.label !== '其他') nw.triggers.push(e.label);
        });
        break;
      }

      case 'stmt':
      case 'call':
      case 'block':
      case 'return':
      case 'jump': {
        // 一个节点可能含多语句（mkRunFrag 合并连续语句），按语句顺序处理：
        // 调用收集先行，赋值 flush 时调用归属于赋值前的状态
        let cur = w.current;
        let caseHint = w.caseHint;
        let triggers = [...w.triggers];
        let calls = [...w.calls];
        let terminalHit = false;
        for (const st of label.split(/[;\n]+/)) {
          for (const cm of st.matchAll(/(\w+)\s*\(/g)) {
            const n = cm[1];
            if (!CALL_FILTER_RE.test(n) && !shortOf.has(n)) calls.push(n);
          }
          // 提前终止：PwrShdn/SafeState 类调用 → current → [*]，剪枝不走后续
          if (TERMINAL_CALL_RE.test(st) && (caseHint ?? cur)) {
            facts.transitions.push({
              from: caseHint ?? cur, to: '[*]', trigger: joinTriggers(triggers),
              fn: fnName, row: node.rowFrom, terminal: true,
            });
            pushCalls((caseHint ?? cur)!, calls);
            terminalHit = true;
            break;
          }
          const am = st.match(assignRe);
          const to = am ? resolveState(am[1]) : null;
          if (am && to) {
            facts.transitions.push({
              from: caseHint ?? cur, to, trigger: joinTriggers(triggers),
              fn: fnName, row: node.rowFrom,
            });
            if (caseHint ?? cur) pushCalls((caseHint ?? cur)!, calls);
            cur = to; caseHint = null; triggers = []; calls = [];
          }
        }
        if (terminalHit) break;
        if (node.kind === 'return') {
          if (cur) pushCalls(cur, calls);
          break;
        }
        follow(() => true, nw => { nw.current = cur; nw.caseHint = caseHint; nw.triggers = triggers; nw.calls = calls; });
        break;
      }

      default:
        follow(() => true, () => {});
    }
  }
  return facts;
}

function joinTriggers(triggers: string[]): string {
  const seen: string[] = [];
  for (const t of triggers) {
    const c = t.replace(/\s+/g, ' ').trim();
    if (c && !seen.includes(c)) seen.push(c);
  }
  // 过长时在 && 子句边界截断（不腰斩宏名），尾部标注省略
  let s = '';
  for (const c of seen) {
    const next = s ? `${s} && ${c}` : c;
    if (next.length > 160) return `${s} && …`;
    s = next;
  }
  return s;
}

/** 函数排序权重：PreInit→Init→Startup→MainFunction→其他（跨函数 current 携带顺序） */
export function fnRank(name: string): number {
  if (/PreInit/i.test(name)) return 0;
  if (/Startup/i.test(name)) return 2;
  if (/Main[Ff]unction/i.test(name)) return 3;
  if (/_Init\b|_Init$/i.test(name)) return 1;
  return 4;
}

/** 初态（复位值）：宏值里含数值 0 的状态。宏值形如 ((Type)0x00U)，须抽取数值再判 */
export function smInitialState(candidate: SmCandidate): string | null {
  const zero = candidate.states.find(s => {
    const m = s.value.match(/0x[0-9a-fA-F]+|\d+/);
    return m !== null && parseInt(m[0], 0) === 0;
  });
  return zero?.name ?? null;
}

export interface SmBuildFacts {
  candidate: SmCandidate;
  /** 按角色一份（null=不分图）；role 非 null 表示该角色剪枝后的解释结果 */
  perRole: { role: 'master' | 'satellite' | null; transitions: SmTransitionFact[]; stateCalls: Map<string, string[]>; caseStates: Set<string> }[];
  warnings: string[];
  /** 部分函数 CFG 失败走了行级兜底 */
  partial: boolean;
}

/**
 * 提取入口：候选 + 驱动函数 CFG 解释。readSource 缺失/定位失败的函数走 bodyText 行级兜底。
 * entryCurrent 规则：init 类函数（rank≤2）入口=初态（值 0 的 define）或上一 init 类函数的出口；
 * 非 init 类入口=null（from 兜底「任意状态」）。
 */
export async function extractStateMachineFacts(
  model: ModuleModel,
  readSource?: (relPath: string) => string | null,
): Promise<SmBuildFacts | null> {
  const candidate = findSmCandidate(model);
  if (!candidate) return null;
  const warnings: string[] = [];
  let partial = false;

  const { field } = candidate;
  if (!field) {
    warnings.push('状态变量字段定位失败，无法提取迁移');
    return { candidate, perRole: [], warnings, partial: true };
  }
  const shortOf = new Map(candidate.states.map(s => [s.full, s.name]));
  const macroAlt = candidate.states.map(s => s.full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const { prefix, suffix } = commonAffix(candidate.states.map(s => s.full));
  const implicit = new Map<string, string>();

  // 驱动函数：体内引用状态字段或族宏
  const drivers = [...model.providedFunctions, ...model.internalFunctions]
    .filter(fn => {
      const body = `${fn.bodyText ?? ''}\n${fn.bodyTextWithPP ?? ''}`;
      return body.includes(field) || candidate.states.some(s => body.includes(s.full));
    })
    .sort((a, b) => fnRank(a.name) - fnRank(b.name) || a.lineStart - b.lineStart);
  if (drivers.length === 0) {
    warnings.push('无引用状态变量的函数，无法提取迁移');
    return { candidate, perRole: [], warnings, partial: true };
  }

  // 第一遍：收集 GetCoreId 返回值变量（角色分支检测）
  const coreIdVars: string[] = [];
  for (const fn of drivers) {
    for (const m of (fn.bodyText ?? '').matchAll(new RegExp(COREID_ASSIGN_RE, 'g'))) {
      if (!coreIdVars.includes(m[1])) coreIdVars.push(m[1]);
    }
  }

  const initial = smInitialState(candidate);

  // CFG 解释（每函数每角色一遍）；CFG 失败 → bodyText 行级兜底
  async function interpretFn(fn: FunctionUnit, role: 'master' | 'satellite' | null, entry: string | null): Promise<SmFnFacts> {
    const src = readSource?.(fn.file);
    if (!src) {
      partial = true;
      warnings.push(`读不到 ${fn.file}，${fn.name} 走行级兜底`);
      return interpretBodyText(fn, role, entry);
    }
    try {
      const cfg = await locateFnCfg(fn, src);
      return interpretCfg(cfg, { field, shortOf, macroAlt, role, coreIdVars, fnName: fn.name, entryCurrent: entry, prefix, suffix, implicit });
    } catch (err) {
      partial = true;
      warnings.push(`${fn.name} CFG 构建失败（${(err as Error).message}），走行级兜底`);
      return interpretBodyText(fn, role, entry);
    }
  }

  /** L2 行级兜底：bodyText 正则扫赋值/自旋，from 用 entry 顺序推进 */
  function interpretBodyText(fn: FunctionUnit, _role: 'master' | 'satellite' | null, entry: string | null): SmFnFacts {
    const facts: SmFnFacts = { transitions: [], stateCalls: new Map(), roleCondFound: false, caseStates: new Set() };
    if (!field) return facts;
    const esc = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const assignG = new RegExp(`\\b${esc}\\b[^;=]*?(?<![=!<>])=\\s*(${macroAlt})\\b`, 'g');
    let cur = entry;
    (fn.bodyText ?? '').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(assignG)) {
        facts.transitions.push({ from: cur, to: shortOf.get(m[1])!, trigger: `${fn.name} 第 ${i + 1} 行`, fn: fn.name, row: i });
        cur = shortOf.get(m[1])!;
      }
    });
    return facts;
  }

  // 角色检测：先无剪枝走一遍看有没有角色分支；有则按角色各走一遍
  async function walkAll(role: 'master' | 'satellite' | null): Promise<SmBuildFacts['perRole'][number]> {
    const merged = { role, transitions: [] as SmTransitionFact[], stateCalls: new Map<string, string[]>(), caseStates: new Set<string>() };
    let carry: string | null = initial;
    for (const fn of drivers) {
      const rank = fnRank(fn.name);
      const entry = rank <= 2 ? carry : null;
      const f = await interpretFn(fn, role, entry);
      merged.transitions.push(...f.transitions);
      for (const [k, v] of f.stateCalls) {
        const arr = merged.stateCalls.get(k) ?? [];
        for (const c of v) if (!arr.includes(c)) arr.push(c);
        merged.stateCalls.set(k, arr);
      }
      for (const c of f.caseStates) merged.caseStates.add(c);
      if (rank <= 2) {
        const last = f.transitions.filter(t => t.to !== '[*]').slice(-1)[0];
        if (last) carry = last.to;
      }
    }
    return merged;
  }

  // 先试无剪枝：若任何函数发现角色分支且主从结果不同 → 分图
  const probe = await walkAll(null);
  const hasRoleCond = coreIdVars.length > 0 && (await hasRoleBranch());
  async function hasRoleBranch(): Promise<boolean> {
    // 探测：任意驱动函数 CFG 里存在角色 cond（复用 probe 的 warnings 已记录定位失败）
    for (const fn of drivers) {
      const src = readSource?.(fn.file);
      if (!src) continue;
      try {
        const cfg = await locateFnCfg(fn, src);
        const f = interpretCfg(cfg, { field, shortOf, macroAlt, role: null, coreIdVars, fnName: fn.name, entryCurrent: null, prefix, suffix, implicit });
        if (f.roleCondFound) return true;
      } catch { /* 定位失败已记录 */ }
    }
    return false;
  }

  // 隐式状态（赋给状态字段但不在族清单的同前缀裸宏，如 GP_TLF35584_INITIAL_TASK）并入候选
  for (const [full, name] of implicit) {
    if (!candidate.states.some(s => s.full === full)) {
      candidate.states.push({ full, name, value: '', description: '' });
    }
  }

  if (!hasRoleCond) return { candidate, perRole: [probe], warnings, partial };

  const master = await walkAll('master');
  const satellite = await walkAll('satellite');
  const norm = (ts: SmTransitionFact[]) => ts.map(t => `${t.from}->${t.to}:${t.trigger}`).sort().join('|');
  // 两角色无差异 → 单图（IoM 式 GetCoreId 索引用法不落这里：roleCondFound 本身就不成立）
  if (norm(master.transitions) === norm(satellite.transitions)) {
    return { candidate, perRole: [probe], warnings, partial };
  }
  return { candidate, perRole: [master, satellite], warnings, partial };
}
