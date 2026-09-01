/**
 * Mermaid 源码预处理（报告与 Polarion 单图渲染页共用，保证两边图一致）。
 * 从 htmlReport.ts 抽取，逻辑零改动。
 */

/**
 * 流程图 label 预折行：节点文字靠浏览器对 foreignObject 内 HTML 自动折行（mermaid label max-width 200px），
 * 个别浏览器中该折行失效，超长单行会被裁剪/溢出节点框。这里按估算像素宽度把每个 <br> 分段
 * 预先折到 200px 以内（优先在空格处断开，无空格长 token 硬断），渲染结果不再依赖浏览器折行。
 */
export function wrapFlowchartLabels(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const MAX_W = 185;  // px @13px 字号，对 200px 上限留余量
  const charW = (ch: string) => (ch.charCodeAt(0) < 0x7f ? 7 : 13.5);  // ASCII ≈7px，全角/CJK ≈13.5px
  const segWidth = (s: string) => [...s.replace(/<[^>]+>/g, '')].reduce((w, c) => w + charW(c), 0);
  const wrapSeg = (seg: string): string => {
    if (segWidth(seg) <= MAX_W) return seg;
    const atoms = seg.match(/<[^>]+>|[\s\S]/g) ?? [];   // HTML 标签作为整体原子，不计宽、不在内部断
    const lines: string[] = [];
    let line = '', w = 0, lastSpace = -1, lastParen = -1;  // lastParen：（的下标，次优断点（断在其前）
    for (const atom of atoms) {
      if (atom.length > 1 && atom.startsWith('<')) { line += atom; continue; }
      const cw = charW(atom);
      if (w + cw > MAX_W && line) {
        if (lastSpace > 0) {                 // 回退到本行最后一个空格处断开
          lines.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1);
        } else if (lastParen > 0) {          // 无空格时优先断在（前，避免拆散括号词
          lines.push(line.slice(0, lastParen));
          line = line.slice(lastParen);
        } else {                             // 无空格长 token：硬断
          lines.push(line);
          line = '';
        }
        w = segWidth(line);
        lastSpace = line.lastIndexOf(' ');
        lastParen = line.lastIndexOf('（');
        if (atom === ' ') continue;          // 断点处的空格丢弃
      }
      if (atom === ' ') lastSpace = line.length;
      if (atom === '（') lastParen = line.length;
      line += atom; w += cw;
    }
    if (line) lines.push(line);
    return lines.join('<br>');
  };
  return src.split('\n').map(l =>
    // subgraph 标题（条件编译注释）不折行：mermaid 按单行计算框顶高度，多行标题会压到框内节点
    /^\s*subgraph\s/.test(l) ? l : l.replace(/"([^"\n]*)"/g, (_m, label: string) =>
      `"${label.split(/<br\s*\/?>/i).map(wrapSeg).join('<br>')}"`),
  ).join('\n');
}

/**
 * 「结束」节点钉底：dagre 最长路径排名把结束放在其入边来源（多为循环条件菱形）的下一层，
 * 循环体更深时结束会悬在图中间（如 CheckInitRslt：D1 --否--> END 与循环体同层）。
 * 这里在 DAG（去回边）上从「开始」算最长路径深度，从所有不浅于结束的节点各引一条
 * ~~~ 隐形链到结束，强制其沉到最底；结束本就在底部的图深度已满、不加任何边，布局零影响。
 */
export function pinEndNodeToBottom(src: string): string {
  if (!/^\s*flowchart/.test(src)) return src;
  const lines = src.split('\n');
  // 体育场形端子节点：ID(["label"])
  const ends: string[] = [];
  let startId: string | null = null;
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*\(\s*\[\s*"([^"]*)"\s*\]\s*\)/g)) {
    const label = m[2].replace(/<br\s*\/?>/gi, '').trim();
    if (/^(结束|End)$/i.test(label)) ends.push(m[1]);
    if (/^(开始|Start)$/i.test(label)) startId = m[1];
  }
  if (ends.length === 0) return src;
  // 解析边（只取 --> / --- 有向/无箭头连线；~~~ 隐形钉链不参与深度）
  const adj = new Map<string, string[]>();
  const nodes = new Set<string>();
  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    nodes.add(a); nodes.add(b);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
  };
  for (const raw of lines) {
    if (/^\s*(subgraph|end\b|style|classDef|class\s|direction|linkStyle|%%)/.test(raw)) continue;
    // 带标签连线归一成裸操作符：D1 -- 是 --> R / W -- 否 --- J
    const line = raw.replace(/--\s*[^-~>\n][^-~>\n]*?\s*(?=-->|---)/g, '');
    if (!/(~~~|-->|---|-\.->|==>)/.test(line)) continue;
    const segs = line.split(/~~~|-->|---|-\.->|==>/);
    if (line.includes('~~~')) continue;  // ~~~ 隐形钉链不参与深度
    const ids = segs.map(s => (s.match(/\b([A-Za-z_]\w*)\b/) ?? [])[1]);
    for (let i = 0; i + 1 < ids.length; i++) {
      if (ids[i] && ids[i + 1]) addEdge(ids[i]!, ids[i + 1]!);
    }
  }
  // DAG 最长路径深度：DFS 丢弃指向栈上祖先的回边（循环回边），深度单调递增必然收敛
  const depth = new Map<string, number>();
  const onStack = new Set<string>();
  const visit = (u: string, d: number): void => {
    if (onStack.has(u) || (depth.get(u) ?? -1) >= d) return;
    depth.set(u, d);
    onStack.add(u);
    for (const v of adj.get(u) ?? []) visit(v, d + 1);
    onStack.delete(u);
  };
  if (startId) visit(startId, 0);
  for (const n of nodes) if (!depth.has(n)) visit(n, 0);  // 开始不可达的游离节点按根处理
  // 从所有不浅于结束的节点引隐形链；插在结束首次出现行之后（保持同一 subgraph 作用域）
  const pins: string[] = [];
  for (const e of ends) {
    const de = depth.get(e) ?? 0;
    for (const [n, d] of depth) if (n !== e && d >= de) pins.push(`    ${n} ~~~ ${e}`);
  }
  if (pins.length === 0) return src;
  const firstEnd = ends[0]!;
  const idx = lines.findIndex(l => new RegExp(`\\b${firstEnd}\\b`).test(l));
  lines.splice(idx >= 0 ? idx + 1 : lines.length, 0, ...pins);
  return lines.join('\n');
}
