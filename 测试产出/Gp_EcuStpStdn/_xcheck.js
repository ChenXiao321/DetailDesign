// 全图扫描：渲染后 HTML 中所有 flowchart 边（已直角化）两两查严格 X 交叉
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_EcuStpStdn/lld_report.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
let total = 0;
svgs.forEach((svg, si) => {
  const edges = [];
  for (const m of svg.matchAll(/<path [^>]*\sd="([^"]+)"[^>]*id="(L_[^"]+)"[^>]*>/g)) {
    const pts = [...m[1].matchAll(/([\d.]+),([\d.]+)/g)].map(p => [+p[1], +p[2]]);
    // ~~~ 隐形钉链（edge-thickness-invisible）不渲染，不参与交叉判定
    const invisible = /edge-thickness-invisible/.test(m[0]);
    edges.push({ id: m[2], pts, invisible });
  }
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
  if (hits.length) { total += hits.length; console.log(`svg#${si}:`); hits.forEach(h => console.log('  ' + h)); }
});
console.log(total ? `共 ${total} 处严格交叉` : '全部图无严格交叉');
