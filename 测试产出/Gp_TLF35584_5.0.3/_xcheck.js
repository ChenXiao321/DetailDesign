// 全图扫描：渲染后 HTML 中所有 flowchart 边（已直角化）——
// ① 两两查严格 X 交叉；② 逐段查边穿节点盒（2px 缩边 AABB，源/目标自身除外）；
// ④ 查边深入矩形族目标盒内部（终点前路径进 2px 缩边开盒——竖干线落在目标盒跨度内时
//    末段连箭头埋在节点填充下，如 RtSetMode 图 W2-->END 秃线）。
// 节点盒从标记近似推导（rect 取 x/y/w/h，polygon 取 points 外包），与浏览器 getBBox 略有出入，
// 只用于发现「干线竖穿节点」类明显问题（如 D1--否-->END 干线穿「读 InitCheckRslt」）。
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/lld_report.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
let total = 0, boxHits = 0;
svgs.forEach((svg, si) => {
  const edges = [];
  // 注意：不要用 /<path [^>]*\sd=.../ 单正则——Node 25.2.1 的 V8 Irregexp 对
  // 「字面空格+[^>]*+字面」模式有预检索 bug（实测 /<path [^>]* d/ 对 '<path d=...' 返回 false），
  // 会静默解析出 0 条边造成审计假绿。改为两步：先取 <path> 整标签，再分别抽 d 与 id。
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const dm = tag.match(/d="([^"]+)"/);
    const im = tag.match(/id="(L_[^"]+)"/);
    if (!dm || !im) continue;
    const pts = [...dm[1].matchAll(/([\d.]+),([\d.]+)/g)].map(p => [+p[1], +p[2]]);
    // ~~~ 隐形钉链（edge-thickness-invisible）不渲染，不参与交叉判定
    const invisible = /edge-thickness-invisible/.test(tag);
    edges.push({ id: im[1], pts, invisible });
  }
  // 节点盒（离线近似）
  const boxes = {};
  const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+" transform="translate\((-?[\d.]+), (-?[\d.]+)\)"([\s\S]*?)(?=<g class="node|<g class="edgeLabel|<\/svg>)/g;
  let gm;
  while ((gm = gRe.exec(svg))) {
    const id = gm[1], tx = +gm[2], ty = +gm[3], body = gm[4];
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    const rm = body.match(/<rect[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    const pm = body.match(/<polygon points="([^"]+)"[^>]*transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
    if (rm) { x1 = +rm[1]; y1 = +rm[2]; x2 = x1 + +rm[3]; y2 = y1 + +rm[4]; }
    else if (pm) {
      const pp = [...pm[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(q => [+q[1] + +pm[2], +q[2] + +pm[3]]);
      x1 = Math.min(...pp.map(p => p[0])); x2 = Math.max(...pp.map(p => p[0]));
      y1 = Math.min(...pp.map(p => p[1])); y2 = Math.max(...pp.map(p => p[1]));
    } else continue;
    boxes[id] = { x: x1 + tx, y: y1 + ty, w: x2 - x1, h: y2 - y1, poly: !rm && !!pm };
  }
  // 边 id 拆源/目标
  const endsOf = (edgeId) => {
    const em = edgeId.match(/^L_(.+)_\d+$/);
    if (!em) return null;
    const core = em[1];
    for (let i = 1; i < core.length - 1; i++) {
      if (core[i] !== '_') continue;
      if (boxes[core.slice(0, i)] && boxes[core.slice(i + 1)]) return [core.slice(0, i), core.slice(i + 1)];
    }
    return null;
  };
  // ① 边-边严格交叉
  const hits = [];
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    if (a.invisible || b.invisible) continue;
    // 同源的出边共点出发、同目标的入边汇聚：跳过共享端点接触，严格交叉仍报
    for (let k = 0; k < a.pts.length - 1; k++) for (let l = 0; l < b.pts.length - 1; l++) {
      const [p1, p2] = [a.pts[k], a.pts[k + 1]], [q1, q2] = [b.pts[l], b.pts[l + 1]];
      const aVert = Math.abs(p1[0] - p2[0]) < 0.6, bVert = Math.abs(q1[0] - q2[0]) < 0.6;
      if (aVert === bVert) continue; // 平行不算（共线重叠另说）
      const [v1, v2, h1, h2] = aVert ? [p1, p2, q1, q2] : [q1, q2, p1, p2];
      const vx = v1[0], hy = h1[1];
      const inV = hy > Math.min(v1[1], v2[1]) + 0.6 && hy < Math.max(v1[1], v2[1]) - 0.6;
      const inH = vx > Math.min(h1[0], h2[0]) + 0.6 && vx < Math.max(h1[0], h2[0]) - 0.6;
      if (inV && inH) hits.push(`${a.id}#seg${k} X ${b.id}#seg${l} @(${vx.toFixed(1)},${hy.toFixed(1)})`);
    }
  }
  if (hits.length) { total += hits.length; console.log(`svg#${si} 边交叉:`); hits.forEach(h => console.log('  ' + h)); }
  // ② 边穿节点盒
  const bhits = [];
  for (const e of edges) {
    if (e.invisible) continue;
    const ends = endsOf(e.id);
    if (!ends) continue;
    for (let k = 0; k < e.pts.length - 1; k++) {
      const [a, b] = [e.pts[k], e.pts[k + 1]];
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
      const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
      for (const id in boxes) {
        if (id === ends[0] || id === ends[1]) continue;
        const bx = boxes[id];
        if (x1 < bx.x + bx.w - 2 && x2 > bx.x + 2 && y1 < bx.y + bx.h - 2 && y2 > bx.y + 2)
          bhits.push(`${e.id}#seg${k} 穿 ${id} 盒`);
      }
    }
  }
  // ③ 边越出 viewBox（SVG 不渲染 viewBox 外内容，如自旋回边右扩后回路被截）
  const vbm = svg.match(/viewBox="(-?[\d.]+)[ ,]+(-?[\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
  if (vbm) {
    const [vx, vy, vw, vh] = [+vbm[1], +vbm[2], +vbm[3], +vbm[4]];
    for (const e of edges) {
      if (e.invisible) continue;
      for (const [px, py] of e.pts) {
        if (px < vx - 0.5 || px > vx + vw + 0.5 || py < vy - 0.5 || py > vy + vh + 0.5) {
          boxHits++; console.log(`svg#${si} 边越出 viewBox: ${e.id} @(${px.toFixed(1)},${py.toFixed(1)})`);
          break;
        }
      }
    }
  }
  if (bhits.length) { boxHits += bhits.length; console.log(`svg#${si} 边穿节点盒:`); bhits.forEach(h => console.log('  ' + h)); }
  // ④ 边深入矩形族目标盒内部：终点前的路径进入目标盒 2px 缩边开盒（slab 法）——
  // ② 把源/目标盒排除了（箭尖总要触边），但竖干线落在目标盒跨度内时末段连箭头
  // 一起埋在节点填充下（RtSetMode 图 W2-->END 干线 x=444.61 ∈「结束」盒 x 跨度，秃线）。
  // polygon 目标斜边端点本就在包围盒内，恒误报，跳过。
  const phits = [];
  for (const e of edges) {
    if (e.invisible) continue;
    const ends = endsOf(e.id);
    if (!ends) continue;
    const tb = boxes[ends[1]];
    if (!tb || tb.poly) continue;
    const x1 = tb.x + 2, x2 = tb.x + tb.w - 2, y1 = tb.y + 2, y2 = tb.y + tb.h - 2;
    for (let k = 0; k < e.pts.length - 1; k++) {
      const a = e.pts[k], b = e.pts[k + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (a[0] <= x1 || a[0] >= x2) continue; }
      else {
        let ta = (x1 - a[0]) / dx, tb2 = (x2 - a[0]) / dx;
        if (ta > tb2) { const t = ta; ta = tb2; tb2 = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb2);
        if (t0 >= t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (a[1] <= y1 || a[1] >= y2) continue; }
      else {
        let ta = (y1 - a[1]) / dy, tb2 = (y2 - a[1]) / dy;
        if (ta > tb2) { const t = ta; ta = tb2; tb2 = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb2);
        if (t0 >= t1) continue;
      }
      phits.push(`${e.id}#seg${k} 深入目标盒 ${ends[1]}`);
      break;
    }
  }
  if (phits.length) { boxHits += phits.length; console.log(`svg#${si} 边深入目标盒:`); phits.forEach(h => console.log('  ' + h)); }
  // ⑤ 横段贴盒缘（美观）：横段与其他节点顶/底边共线（<1px）且横向重叠——像从盒上碾过
  // （SinSafetyBistCheck 图 P2-->D0 回边横段与 E2 顶边完全贴合）。源/目标盒自身除外。
  const hhits = [];
  for (const e of edges) {
    if (e.invisible) continue;
    const ends = endsOf(e.id);
    for (let k = 0; k < e.pts.length - 1; k++) {
      const a = e.pts[k], b = e.pts[k + 1];
      if (Math.abs(a[1] - b[1]) >= 0.6) continue;
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
      for (const id in boxes) {
        if (ends && (id === ends[0] || id === ends[1])) continue;
        const bx = boxes[id];
        for (const ey of [bx.y, bx.y + bx.h]) {
          if (Math.abs(a[1] - ey) < 1 && x2 > bx.x + 1 && x1 < bx.x + bx.w - 1)
          { hhits.push(`${e.id}#seg${k} 贴 ${id} ${ey === bx.y ? '顶' : '底'}边`); break; }
        }
      }
    }
  }
  if (hhits.length) { boxHits += hhits.length; console.log(`svg#${si} 横段贴盒缘:`); hhits.forEach(h => console.log('  ' + h)); }
});
console.log((total || boxHits) ? `共 ${total} 处严格交叉、${boxHits} 处穿盒/深入目标盒/越界` : '全部图无严格交叉、无边穿节点盒、无深入目标盒');
