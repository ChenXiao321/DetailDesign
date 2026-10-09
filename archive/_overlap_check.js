// 共线重叠审计：不同边的水平段同 y 重叠 / 垂直段同 x 重叠（xcheck 严格交叉的漏网形态）
// 用法: node _overlap_check.js <lld_report.html>
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(x => x[0]);

function parseSegs(d) {
  // M/L 折线分解（含 C 曲线的边跳过——曲线已属非直角范畴）
  if (/[CQAZ]/.test(d)) return null;
  const nums = d.match(/-?\d+\.?\d*/g).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    if (Math.abs(x2 - x1) < 0.01 && Math.abs(y2 - y1) < 0.01) continue; // 零长
    segs.push({ x1, y1, x2, y2 });
  }
  return segs;
}

let totalHits = 0;
svgs.forEach((svg, si) => {
  const tags = [...svg.matchAll(/<path\b[^>]*>/g)].map(m => m[0])
    .filter(t => /class="[^"]*flowchart-link[^"]*"/.test(t));
  const edges = [];
  for (const t of tags) {
    const id = (t.match(/id="([^"]+)"/) || [])[1] || '';
    const d = (t.match(/d="([^"]+)"/) || [])[1] || '';
    const segs = parseSegs(d);
    if (segs) edges.push({ id, segs });
  }
  const hits = [];
  for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) {
    for (const s1 of edges[a].segs) for (const s2 of edges[b].segs) {
      // 水平×水平共线重叠
      if (Math.abs(s1.y2 - s1.y1) < 0.01 && Math.abs(s2.y2 - s2.y1) < 0.01 && Math.abs(s1.y1 - s2.y1) < 0.6) {
        const lo1 = Math.min(s1.x1, s1.x2), hi1 = Math.max(s1.x1, s1.x2);
        const lo2 = Math.min(s2.x1, s2.x2), hi2 = Math.max(s2.x1, s2.x2);
        const ov = Math.min(hi1, hi2) - Math.max(lo1, lo2);
        const opposite = Math.sign(s1.x2 - s1.x1) !== Math.sign(s2.x2 - s2.x1);
        if (ov > 1) hits.push(`${opposite ? '【对向=真交叉】' : '【同向=汇合】'}${edges[a].id} × ${edges[b].id} 水平重叠 ${ov.toFixed(1)}px @y=${s1.y1.toFixed(1)}`);
      }
      // 垂直×垂直共线重叠
      if (Math.abs(s1.x2 - s1.x1) < 0.01 && Math.abs(s2.x2 - s2.x1) < 0.01 && Math.abs(s1.x1 - s2.x1) < 0.6) {
        const lo1 = Math.min(s1.y1, s1.y2), hi1 = Math.max(s1.y1, s1.y2);
        const lo2 = Math.min(s2.y1, s2.y2), hi2 = Math.max(s2.y1, s2.y2);
        const ov = Math.min(hi1, hi2) - Math.max(lo1, lo2);
        const opposite = Math.sign(s1.y2 - s1.y1) !== Math.sign(s2.y2 - s2.y1);
        if (ov > 1) hits.push(`${opposite ? '【对向=真交叉】' : '【同向=汇合】'}${edges[a].id} × ${edges[b].id} 垂直重叠 ${ov.toFixed(1)}px @x=${s1.x1.toFixed(1)}`);
      }
    }
  }
  if (hits.length) {
    totalHits += hits.length;
    console.log(`svg#${si + 1}: ${hits.length} 处共线重叠`);
    for (const h of hits) console.log('   ', h);
  }
});
console.log(totalHits === 0 ? '全部无共线重叠' : `共 ${totalHits} 处`);
