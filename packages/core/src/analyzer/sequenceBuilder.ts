/**
 * 确定性序列图生成（第一步）：函数 CFG → 序列事件树（09-21 定调「序列图不依赖 LLM」）。
 *
 * 与流程图/状态机同源（cfgBuilder），把控制流机械映射为组合片段：
 *  - if/else → alt/else（else-if 链按「否边直达菱形且汇合点相同」压平为多路 alt）；
 *    if 无 else 或 else 无消息 → opt；while/for → loop；空体自旋同样 loop；
 *  - 角色分支（GetCoreId 返回值变量紧邻比较，roleEdgeForLabel 同 SM 口径）→
 *    按角色剪枝只走一边，不画片段（分图由 staticSequence 组织）；
 *  - 条件编译区域（cfg.regions，节点带最内层归属）→ 事件后处理包层：
 *    同区域相邻事件按分支分组成 opt「宏 生效时」/ alt「宏 生效时 / else 未生效时」；
 *  - return/break/continue 结束本路径（序列图不画返回消息）。
 *
 * 消息 = 语句节点内调用按源码出现顺序提取（左到右）；参与者归属由调用方经
 * resolveParticipant 注入（本模块/Callout/宏未知 → 自调用别名）。
 * 标签一律代码原文（09-16 定调纯代码原文、零 LLM）；只画直接调用，不递归展开。
 */
import type { Cfg, CfgNode, CondRegionInfo } from './cfgBuilder.js';
import { roleEdgeForLabel } from './stateMachineBuilder.js';

export type SeqEvent =
  | { kind: 'msg'; to: string; text: string; rpath: string }
  | { kind: 'alt'; branches: { label: string | null; events: SeqEvent[] }[]; rpath: string }
  | { kind: 'opt'; label: string; events: SeqEvent[]; rpath: string }
  | { kind: 'loop'; label: string; events: SeqEvent[]; rpath: string };

export interface SeqWalkCtx {
  /** 角色剪枝（null=不剪枝）；有角色分支的函数由调用方分两次走 */
  role: 'master' | 'satellite' | null;
  /** GetCoreId 返回值变量（角色分支判定） */
  coreIdVars: string[];
  /** 调用名 → 参与者别名（本模块/Callout/宏未知 → 自调用别名，由调用方定） */
  resolveParticipant: (callee: string) => string;
  /** 自调用别名（本模块） */
  selfAlias: string;
}

export interface SeqBuildResult {
  events: SeqEvent[];
  warnings: string[];
  /** 本函数 CFG 中是否存在角色分支（分图决策用） */
  roleCondSeen: boolean;
}

/** 调用名提取过滤：控制流关键字/伪调用不画；NOP 仅在循环体内画（自旋等待的循环体
 *  就是 NOP，v6 口径），其余场景是噪音 */
const KEYWORD_RE = /^(if|else|while|for|do|switch|case|return|sizeof|goto|break|continue)$/;
const NOP_RE = /NOP/i;

/** 行内标签清洗（组合片段标头用）：剥注释、归一空白、禁字符替换（" : ;）、截断 */
function sanitizeInline(raw: string): string {
  let s = raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;\s*$/, '');
  s = s.replace(/"/g, "'").replace(/:/g, '：').replace(/;/g, '；');
  return s.length > 120 ? s.slice(0, 119) + '…' : s;
}

export function buildSequenceEvents(cfg: Cfg, ctx: SeqWalkCtx): SeqBuildResult {
  const warnings: string[] = [];
  const live = cfg.nodes.filter(n => !n.dead);
  const liveSeqs = new Set(live.map(n => n.seq));
  const nodeOf = (seq: number): CfgNode | undefined => {
    const n = cfg.nodes[seq];
    return n && !n.dead ? n : undefined;
  };
  const outEdges = new Map<number, typeof cfg.edges>();
  for (const e of cfg.edges) {
    if (!liveSeqs.has(e.from) || !liveSeqs.has(e.to)) continue;
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  }

  // 循环头：真回边判定（环可达性）——不能按 seq 大小比：END 的 seq=1，任何 return→END
  // 边都是「from>to」；wire() 惰性插入的汇合点也是高 seq 指低 seq（Mainfunction 实测误报）
  const canReach = (from: number, to: number): boolean => {
    const seen = new Set<number>([from]);
    const q = [from];
    while (q.length > 0) {
      const s = q.pop()!;
      for (const e of outEdges.get(s) ?? []) {
        if (e.to === to) return true;
        if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
      }
    }
    return false;
  };
  const loopHeaders = new Set<number>();
  for (const e of cfg.edges) {
    if (!liveSeqs.has(e.from) || !liveSeqs.has(e.to)) continue;
    if (nodeOf(e.to)?.kind === 'cond' && canReach(e.to, e.from)) loopHeaders.add(e.to);
  }

  // ---- 后支配（join 计算）：pdom 单调收缩至不动点 ----
  const pdom = new Map<number, Set<number>>();
  const all = new Set(live.map(n => n.seq));
  for (const n of live) pdom.set(n.seq, n.seq === cfg.endSeq ? new Set([n.seq]) : new Set(all));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of live) {
      if (n.seq === cfg.endSeq) continue;
      const succs = (outEdges.get(n.seq) ?? []).map(e => e.to);
      let inter: Set<number> | null = null;
      for (const s of succs) {
        const ps = pdom.get(s)!;
        if (inter === null) inter = new Set<number>(ps);
        else inter = new Set<number>([...inter].filter((x: number) => ps.has(x)));
      }
      const next = new Set([n.seq, ...(inter ?? [])]);
      if (next.size !== pdom.get(n.seq)!.size) { pdom.set(n.seq, next); changed = true; }
    }
  }
  /** 直接后支配（最近的必经后继）；无（仅 END 路径）时返回 endSeq */
  const ipdom = (seq: number): number => {
    const s = new Set(pdom.get(seq) ?? []);
    s.delete(seq);
    for (const x of s) {
      let ok = true;
      for (const o of s) if (o !== x && !pdom.get(x)!.has(o)) { ok = false; break; }
      if (ok) return x;
    }
    return cfg.endSeq;
  };

  /** 节点的区域路径（外层→内层 '区域:分支' 段，/ 连接）；无区域归属为 '' */
  const rpathOf = (n: CfgNode): string => {
    if (n.region === undefined || n.branch === undefined) return '';
    const chain: string[] = [];
    let ri: number | undefined = n.region;
    let bi = n.branch;
    while (ri !== undefined) {
      chain.unshift(`${ri}:${bi}`);
      const parent: number | undefined = cfg.regions[ri]?.parent;
      if (parent === undefined) break;
      const p = cfg.regions[parent];
      const self = cfg.regions[ri];
      bi = Math.max(0, p.branches.findIndex(b => self.from >= b.from && self.to - 1 <= b.to));
      ri = parent;
    }
    return chain.join('/');
  };

  /** 片段事件的区域路径 = 自身（cond 头部）与全部子孙事件的公共前缀。
   *  关键：子孙逃出自身区域时前缀收缩（Startup 实测 #endif 夹断——else 关键字在
   *  SAFETY 区域内、else 体在区域外），收缩后包层只圈真正同区域的内容 */
  const commonRpath = (own: string, evts: SeqEvent[]): string => {
    let prefix: string[] | null = own === '' ? null : own.split('/');
    const visit = (es: SeqEvent[]): void => {
      for (const e of es) {
        const segs = e.rpath === '' ? ([] as string[]) : e.rpath.split('/');
        if (prefix === null) prefix = segs;
        else {
          let k = 0;
          while (k < prefix.length && k < segs.length && prefix[k] === segs[k]) k++;
          prefix = prefix.slice(0, k);
        }
        if (e.kind === 'opt' || e.kind === 'loop') visit(e.events);
        else if (e.kind === 'alt') e.branches.forEach(b => visit(b.events));
      }
    };
    visit(evts);
    return (prefix ?? []).join('/');
  };

  // ---- 遍历状态 ----
  const emitted = new Set<number>();   // 已产出消息的节点（do-while 回走/落空 case 防重）
  let roleCondSeen = false;

  const emitCalls = (n: CfgNode, out: SeqEvent[], inLoop: boolean): void => {
    if (emitted.has(n.seq)) return;
    emitted.add(n.seq);
    const rpath = rpathOf(n);
    for (const stmt of n.label.split('\n')) {
      for (const m of stmt.matchAll(/([A-Za-z_]\w*)\s*\(/g)) {
        const callee = m[1];
        if (KEYWORD_RE.test(callee)) continue;
        if (NOP_RE.test(callee) && !inLoop) continue;
        out.push({ kind: 'msg', to: ctx.resolveParticipant(callee), text: `${callee}()`, rpath });
      }
    }
  };

  /** 顺序后继（非分支节点的唯一出边）；多出路取第一并告警 */
  const followSingle = (seq: number): number | null => {
    const es = (outEdges.get(seq) ?? []).filter(e => !e.noArrow);
    if (es.length === 0) return null;
    if (es.length > 1) warnings.push(`节点 ${seq} 非条件节点却有多条出边，取第一条（结构可能异常）`);
    return es[0].to;
  };

  /** 主递归：从 seq 沿控制流走，遇 stops 停止；事件追加到 out */
  const walkSeq = (seq: number, stops: Set<number>, out: SeqEvent[], inLoop: boolean, depth: number): void => {
    let cur: number | null = seq;
    const guard = new Set<number>();
    while (cur !== null) {
      if (stops.has(cur) || depth > 40) return;
      if (guard.has(cur)) return;
      guard.add(cur);
      const n = nodeOf(cur);
      if (!n) return;
      if (n.kind === 'end' || n.kind === 'return' || n.kind === 'jump') return;
      if (n.kind === 'merge') { cur = followSingle(cur); continue; }
      if (n.kind === 'cond') { cur = handleCond(n, stops, out, inLoop, depth); continue; }
      // stmt / call / block：提取调用消息
      emitCalls(n, out, inLoop);
      cur = followSingle(cur);
    }
  };

  /** 条件节点分派：返回主链继续的节点（null=止） */
  const handleCond = (n: CfgNode, stops: Set<number>, out: SeqEvent[], inLoop: boolean, depth: number): number | null => {
    const es = (outEdges.get(n.seq) ?? []).filter(e => !e.noArrow);
    const label = sanitizeInline(n.label);
    // 条件表达式内的调用也是交互（if (Foo() == FALSE) 的 Foo() 必须发消息，v6 口径）——
    // 片段标头保持条件原文，调用本身在片段前发一条消息
    emitCalls(n, out, inLoop);

    // ① 角色分支：按角色剪枝，不画片段
    const roleEdge = roleEdgeForLabel(n.label, ctx.coreIdVars);
    if (roleEdge !== null) {
      roleCondSeen = true;
      if (ctx.role === null) {
        // 不剪枝的探测走法：两边都走（汇合点相同，emitted 防重——后走的一边只补差异）
        for (const e of es) walkSeq(e.to, stops, out, inLoop, depth + 1);
        return ipdom(n.seq);
      }
      const want = ctx.role === 'master' ? roleEdge : roleEdge === '是' ? '否' : '是';
      const pick = es.find(e => e.label === want) ?? es[0];
      return pick ? pick.to : null;
    }

    // ② 空体自旋：noArrow 回边挂在菱形上（buildWhile 空体契约）
    const spinBack = (outEdges.get(n.seq) ?? []).find(e => e.noArrow);
    if (spinBack) {
      const exit = es.find(e => e.label === '否') ?? es[0];
      warnings.push(`空体自旋「${label}」无循环体消息，片段已省略`);
      return exit ? exit.to : null;
    }

    // ③ 循环（while/for：是边进体、否边出循环；do-while 见下）
    if (loopHeaders.has(n.seq)) {
      const bodyEdge = es.find(e => e.label === '是');
      const exitEdge = es.find(e => e.label === '否');
      const body: SeqEvent[] = [];
      if (bodyEdge) walkSeq(bodyEdge.to, new Set([...stops, n.seq]), body, true, depth + 1);
      if (body.length === 0) {
        warnings.push(`循环「${label}」体内无调用消息，片段已省略`);
      } else {
        out.push({ kind: 'loop', label, events: body, rpath: commonRpath(rpathOf(n), body) });
      }
      return exitEdge ? exitEdge.to : ipdom(n.seq);
    }

    // ④ switch：case/default/其他 多路
    if (/^switch\s*\(/.test(n.label)) {
      const join = ipdom(n.seq);
      const branches: { label: string | null; events: SeqEvent[] }[] = [];
      const seenLabel = new Set<string>();
      for (const e of es) {
        const bl = e.label ?? '其他';
        if (seenLabel.has(bl)) continue;
        seenLabel.add(bl);
        const events: SeqEvent[] = [];
        walkSeq(e.to, new Set([...stops, join]), events, inLoop, depth + 1);
        branches.push({ label: bl === 'default' ? 'default' : bl, events });
      }
      emitAlt(out, branches, rpathOf(n));
      return join;
    }

    // ⑤ if / else-if 链 / else：否边直达菱形且汇合点相同 → 压平多路 alt
    const join = ipdom(n.seq);
    const thenEdge = es.find(e => e.label === '是');
    const elseEdge = es.find(e => e.label === '否');
    const branches: { label: string | null; events: SeqEvent[] }[] = [];
    const thenEvents: SeqEvent[] = [];
    if (thenEdge) walkSeq(thenEdge.to, new Set([...stops, join]), thenEvents, inLoop, depth + 1);
    branches.push({ label, events: thenEvents });

    let elseTarget = elseEdge ? elseEdge.to : null;
    let cur: CfgNode | undefined = elseTarget !== null ? nodeOf(elseTarget) : undefined;
    // else-if 压平：否支直达菱形、非循环/角色分支、且本层 join 在其下游必经路上
    // （join ∈ pdom(cur)：顺序两个 if 时 join 在第二个 if 的上游，不满足，不误压；
    //  else 块内嵌套 if 语义等同 else-if，压平正确）
    while (cur && cur.kind === 'cond' && !loopHeaders.has(cur.seq)
           && (pdom.get(cur.seq)?.has(join) ?? false)
           && roleEdgeForLabel(cur.label, ctx.coreIdVars) === null) {
      const ces = (outEdges.get(cur.seq) ?? []).filter(e => !e.noArrow);
      const cThen = ces.find(e => e.label === '是');
      const cElse = ces.find(e => e.label === '否');
      const ev: SeqEvent[] = [];
      if (cThen) walkSeq(cThen.to, new Set([...stops, join]), ev, inLoop, depth + 1);
      branches.push({ label: sanitizeInline(cur.label), events: ev });
      elseTarget = cElse ? cElse.to : null;
      cur = elseTarget !== null ? nodeOf(elseTarget) : undefined;
    }
    // 收尾 else（非 else-if 的否支）
    if (elseTarget !== null && elseTarget !== join) {
      const ev: SeqEvent[] = [];
      walkSeq(elseTarget, new Set([...stops, join]), ev, inLoop, depth + 1);
      if (ev.length > 0) branches.push({ label: null, events: ev });
    }

    emitAlt(out, branches, rpathOf(n));
    return join;
  };

  /** alt/opt 归并发射：只有一路有消息 → opt（else-only 时标签取反）；全空丢弃（告警）。
   *  片段 rpath 取自身与子树公共前缀（子树逃出 cond 所在区域时收缩，防把未生效代码圈进框） */
  const emitAlt = (out: SeqEvent[], branches: { label: string | null; events: SeqEvent[] }[], rpath: string): void => {
    const nonEmpty = branches.filter(b => b.events.length > 0);
    if (nonEmpty.length === 0) {
      warnings.push(`分支「${branches[0]?.label ?? ''}」各路均无调用消息，片段已省略`);
      return;
    }
    if (nonEmpty.length === 1) {
      const only = nonEmpty[0];
      out.push({ kind: 'opt', label: only.label ?? `!(${branches[0].label})`, events: only.events, rpath: commonRpath(rpath, only.events) });
      return;
    }
    out.push({ kind: 'alt', branches: nonEmpty, rpath: commonRpath(rpath, nonEmpty.flatMap(b => b.events)) });
  };

  const events: SeqEvent[] = [];
  const startOut = followSingle(cfg.startSeq);
  if (startOut !== null) walkSeq(startOut, new Set([cfg.endSeq]), events, false, 0);

  // ---- 条件编译区域包层（同区域相邻事件按分支分组成 opt/alt，嵌套逐层剥） ----
  const branchLabel = (region: CondRegionInfo, bi: number): string => {
    const br = region.branches[bi];
    if (!br || br.kind === 'if') return `${region.macro} 生效时`;
    if (br.kind === 'elif') return `${region.macro} 的 #elif 分支生效时`;
    return `未生效时`;
  };
  /** 剥一层区域路径：仅当事件首段就是当前包裹的区域 ri 才剥（兄弟区域不能剥——
   *  Startup 实测：#endif 夹断的 else 体在 R3 之外，体内的 #if 是平级新区域 R5/R6，
   *  无脑剥首段会把它们的区域归属静默吃掉） */
  const stripFor = (ri: number) => {
    const strip = (e: SeqEvent): SeqEvent => {
      const segs = e.rpath.split('/');
      const hit = segs[0] !== '' && Number(segs[0].split(':')[0]) === ri;
      const rpath = hit ? segs.slice(1).join('/') : e.rpath;
      if (e.kind === 'msg') return { ...e, rpath };
      if (e.kind === 'opt' || e.kind === 'loop') return { ...e, rpath, events: e.events.map(strip) };
      return { ...e, rpath, branches: e.branches.map(b => ({ ...b, events: b.events.map(strip) })) };
    };
    return strip;
  };
  const wrapRegions = (evts: SeqEvent[]): SeqEvent[] => {
    const out: SeqEvent[] = [];
    let i = 0;
    while (i < evts.length) {
      const seg0 = evts[i].rpath.split('/')[0];
      if (seg0 === '') {
        const e = evts[i];
        // 透传事件：递归包层片段内部
        if (e.kind === 'opt' || e.kind === 'loop') out.push({ ...e, events: wrapRegions(e.events) });
        else if (e.kind === 'alt') out.push({ ...e, branches: e.branches.map(b => ({ ...b, events: wrapRegions(b.events) })) });
        else out.push(e);
        i++;
        continue;
      }
      const ri = Number(seg0.split(':')[0]);
      const run: SeqEvent[] = [];
      while (i < evts.length) {
        const s = evts[i].rpath.split('/')[0];
        if (s === '' || Number(s.split(':')[0]) !== ri) break;
        run.push(evts[i]); i++;
      }
      const region = cfg.regions[ri];
      if (!region) { out.push(...run); continue; }
      const byBranch = new Map<number, SeqEvent[]>();
      for (const e of run) {
        const bi = Number(e.rpath.split('/')[0].split(':')[1] ?? '0');
        const arr = byBranch.get(bi) ?? [];
        arr.push(e);
        byBranch.set(bi, arr);
      }
      const bis = [...byBranch.keys()].sort((a, b) => a - b);
      const strip = stripFor(ri);
      const mk = (bi: number) => ({
        label: branchLabel(region, bi) as string | null,
        events: wrapRegions((byBranch.get(bi) ?? []).map(strip)),
      });
      if (bis.length === 1) {
        const b = mk(bis[0]);
        out.push({ kind: 'opt', label: b.label ?? '', events: b.events, rpath: '' });
      } else {
        out.push({ kind: 'alt', branches: bis.map(mk), rpath: '' });
      }
    }
    return out;
  };

  return { events: wrapRegions(events), warnings, roleCondSeen };
}
