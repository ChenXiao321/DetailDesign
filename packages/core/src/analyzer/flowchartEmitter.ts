/**
 * 确定性流程图生成（第二步）：CFG → mermaid flowchart TD 源码。
 *
 * 遵守报告/渲染/审计链路的全部硬约定（mermaidPre.ts lint、renderScript.ts 整形、
 * audit.ts id 试拆），产出图上 lint/结构校验构造性全绿：
 *  - 节点 id 分族 N/D/M 不含下划线（audit 边 id L_A_B_n 试拆唯一）；
 *    自旋回环 J = D{k}_J（renderScript.ts:498-564 契约）；注释 = SGx_NOTE；START/END 固定
 *  - 标签清洗：剥注释、HTML 转义（& < >，先于拼 <br>）、禁字符替换（" ' : ;）、超长截断
 *  - 隐形汇合点 id[" "] + style 全透明（renderScript 坍缩圆点），保证有出边
 *  - 条件编译虚线框：无标题 subgraph + _NOTE 注释节点（含宏名，过 gen 期硬校验）
 *    + ~~~ 钉组内首节点 + dasharray style；嵌套区域归最内层
 */
import type { Cfg, CfgNode, CondRegionInfo } from './cfgBuilder.js';

export interface EmitOptions {
  /** 包裹整个函数的外层宏（fn.conditionalFlags）：非空则全图包一层虚线框 */
  outerMacros?: string[];
}

/** 单语句标签 >160 字符截断；多语句节点最多 8 行 */
const MAX_LINE = 160;
const MAX_LINES = 8;

/** 标签清洗：剥注释→逐行归一→HTML 转义→禁字符替换→截断。多行以 \n 传入、<br> 拼出 */
export function sanitizeLabel(raw: string): string {
  const noComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  let lines = noComments.split('\n').map(l => l.replace(/\s+/g, ' ').trim().replace(/;\s*$/, ''));
  lines = lines.filter(l => l.length > 0);
  let truncated = false;
  const originalCount = lines.length;
  if (lines.length > MAX_LINES) {
    truncated = true;
    lines = lines.slice(0, MAX_LINES - 1);
  }
  // 替换顺序有意义：先做字符级替换（" ' : ;），实体转义（& < >）必须最后做——
  // 否则先转义引入的 &lt; 里的分号会被随后的 ; → ； 替换腐蚀成 &lt；
  const esc = (s: string) =>
    s.replace(/"/g, "'").replace(/:/g, '：').replace(/;/g, '；')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out = lines.map(l => {
    const e = esc(l);
    return e.length > MAX_LINE ? e.slice(0, MAX_LINE - 1) + '…' : e;
  });
  if (truncated) out.push(`…（共 ${originalCount} 行）`);
  return out.join('<br>');
}

export interface EmitResult {
  mmd: string;
  /** 实际画出虚线框的宏（空区域被抑制的不在内）——断言网只应对这些宏查框存在性 */
  framedMacros: string[];
}

export function emitMermaid(cfg: Cfg, opts: EmitOptions = {}): EmitResult {
  const live = cfg.nodes.filter(n => !n.dead);
  const liveSeqs = new Set(live.map(n => n.seq));
  const sorted = [...live].sort((a, b) => a.rowFrom - b.rowFrom || a.seq - b.seq);

  // ---- id 分配（三趟：先 D 后 M 再 N；自旋 J 依赖其菱形的 D id） ----
  const ids = new Map<number, string>();
  ids.set(cfg.startSeq, 'START');
  ids.set(cfg.endSeq, 'END');
  let dCount = 0, mCount = 0, nCount = 0;
  for (const n of sorted) if (n.kind === 'cond') ids.set(n.seq, `D${dCount++}`);
  for (const n of sorted) {
    if (n.kind !== 'merge') continue;
    if (n.spinOf !== undefined && ids.has(n.spinOf)) ids.set(n.seq, `${ids.get(n.spinOf)}_J`);
    else ids.set(n.seq, `M${mCount++}`);
  }
  for (const n of sorted) {
    if (ids.has(n.seq)) continue;
    ids.set(n.seq, `N${nCount++}`);
  }
  const id = (seq: number) => ids.get(seq)!;

  // ---- 声明（按归属分组：顶层节点与区域按行序交错，区域内递归） ----
  const decl: string[] = [];
  const sgStyles: string[] = [];
  const noteIds: string[] = [];
  const framed = new Set<string>();

  const shapeDecl = (n: CfgNode): string => {
    const i = id(n.seq);
    switch (n.kind) {
      case 'start': return `${i}(["开始"])`;
      case 'end': return `${i}(["结束"])`;
      case 'call': return `${i}[["${sanitizeLabel(n.label)}"]]`;
      case 'cond': return `${i}{"${sanitizeLabel(n.label)}"}`;
      case 'merge': return `${i}[" "]`;
      default: return `${i}["${sanitizeLabel(n.label)}"]`;
    }
  };

  const childRegionsOf = (ri: number | null, fromRow: number, toRow: number) =>
    cfg.regions
      .map((r, idx) => ({ r, idx }))
      .filter(({ r, idx }) =>
        (ri === null ? r.parent === undefined : r.parent === ri) &&
        r.from >= fromRow && r.to - 1 <= toRow);

  const emitScope = (indent: string, nodes: CfgNode[], ri: number | null, fromRow: number, toRow: number): void => {
    const regions = childRegionsOf(ri, fromRow, toRow);
    const items = [
      ...nodes.map(n => ({ row: n.rowFrom, seq: n.seq, node: n as CfgNode | null, region: -1 })),
      ...regions.map(({ idx }) => ({ row: cfg.regions[idx].from, seq: Number.MAX_SAFE_INTEGER, node: null as CfgNode | null, region: idx })),
    ].sort((a, b) => a.row - b.row || a.seq - b.seq);
    for (const it of items) {
      if (it.node) decl.push(indent + shapeDecl(it.node));
      else emitRegion(indent, it.region);
    }
  };

  const emitRegion = (indent: string, ri: number): void => {
    const r = cfg.regions[ri];
    for (let b = 0; b < r.branches.length; b++) {
      const br = r.branches[b];
      const branchNodes = sorted.filter(n => n.region === ri && n.branch === b);
      const nested = childRegionsOf(ri, br.from, br.to);
      const nestedNodes = nested.flatMap(({ idx }) => sorted.filter(n => n.region === idx));
      // 空区域抑制：分支内（含嵌套）一个完整语句节点都没有——典型是 #if 只包了一个花括号
      // （条件编译夹断块结构，Startup 实测）。画出来是误导性的空框钉到无关节点，直接省略。
      if (branchNodes.length === 0 && nestedNodes.length === 0) {
        cfg.warnings.push(`条件编译区域 ${r.macro}（${br.kind} 分支）无完整语句，虚线框已省略`);
        continue;
      }
      framed.add(r.macro);
      const sgId = `SG${ri}_${b}`;
      const noteId = `${sgId}_NOTE`;
      noteIds.push(noteId);
      const noteText =
        br.kind === 'if' ? `注：仅在 ${r.macro} 生效时参与编译`
        : br.kind === 'elif' ? `注：仅在 ${r.macro} 的 #elif 分支生效时参与编译`
        : `注：仅在 ${r.macro} 未生效（#else 分支）时参与编译`;
      decl.push(`${indent}subgraph ${sgId}[" "]`);
      decl.push(`${indent}    ${noteId}["${noteText}"]`);
      // 钉位目标：本分支（含嵌套区域）行序首个节点
      const pinTarget = [...branchNodes, ...nestedNodes].sort((a, c) => a.rowFrom - c.rowFrom || a.seq - c.seq)[0]!;
      decl.push(`${indent}    ${noteId} ~~~ ${id(pinTarget.seq)}`);
      emitScope(indent + '    ', branchNodes, ri, br.from, br.to);
      decl.push(`${indent}end`);
      sgStyles.push(`style ${sgId} fill:transparent,stroke:#888888,stroke-dasharray:6 4`);
    }
  };

  const topNodes = sorted.filter(n => n.region === undefined && n.kind !== 'start' && n.kind !== 'end');
  const outer = opts.outerMacros ?? [];
  const startNode = cfg.nodes.find(n => n.seq === cfg.startSeq)!;
  const endNode = cfg.nodes.find(n => n.seq === cfg.endSeq)!;

  if (outer.length > 0) {
    for (const m of outer) framed.add(m);
    const sgId = 'SG_OUT';
    const noteId = 'SG_OUT_NOTE';
    noteIds.push(noteId);
    decl.push(`subgraph ${sgId}[" "]`);
    decl.push(`    ${noteId}["注：仅在 ${outer.join('、')} 生效时参与编译"]`);
    decl.push(`    ${noteId} ~~~ START`);
    decl.push('    ' + shapeDecl(startNode));
    emitScope('    ', topNodes, null, 0, Number.MAX_SAFE_INTEGER);
    decl.push('    ' + shapeDecl(endNode));
    decl.push('end');
    sgStyles.push(`style ${sgId} fill:transparent,stroke:#888888,stroke-dasharray:6 4`);
  } else {
    decl.push(shapeDecl(startNode));
    emitScope('', topNodes, null, 0, Number.MAX_SAFE_INTEGER);
    decl.push(shapeDecl(endNode));
  }

  // ---- 边（创建顺序，两端都在活的节点） ----
  const edgeLines: string[] = [];
  for (const e of cfg.edges) {
    if (!liveSeqs.has(e.from) || !liveSeqs.has(e.to)) continue;
    const a = id(e.from), b = id(e.to);
    if (e.noArrow) edgeLines.push(`${a} --- ${b}`);
    else if (e.label) edgeLines.push(`${a} -- ${e.label} --> ${b}`);
    else edgeLines.push(`${a} --> ${b}`);
  }

  // ---- 样式 ----
  const styleLines: string[] = [];
  for (const n of sorted) {
    if (n.kind === 'merge') styleLines.push(`style ${id(n.seq)} fill:transparent,stroke:transparent`);
  }
  styleLines.push(...sgStyles);
  if (noteIds.length > 0) {
    styleLines.push('classDef condNote fill:#fff8c5,stroke:#eac54f,color:#9a6700');
    styleLines.push(`class ${noteIds.join(',')} condNote`);
  }

  const mmd = ['flowchart TD', ...decl, ...edgeLines, ...styleLines]
    .map(l => (l.length ? `    ${l}` : l))
    .join('\n')
    .replace('    flowchart TD', 'flowchart TD');
  return { mmd, framedMacros: [...framed] };
}
