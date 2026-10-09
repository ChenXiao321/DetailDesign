// 列出报告内全部斜线边（M/L 折线中含 |dx|>0.6 且 |dy|>0.6 的段）
// 用法: node _diag_list.js <lld_report.html>
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(x => x[0]);
const out = [];
svgs.forEach((svg, si) => {
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const t = m[0];
    if (!/class="[^"]*flowchart-link[^"]*"/.test(t)) continue;
    const id = (t.match(/id="([^"]+)"/) || [])[1] || '';
    const d = (t.match(/d="([^"]+)"/) || [])[1] || '';
    if (/[CQAZ]/.test(d)) continue;
    const nums = d.match(/-?\d+\.?\d*/g).map(Number);
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    for (let i = 0; i + 1 < pts.length; i++) {
      const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
      const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
      if (dx > 0.6 && dy > 0.6) { out.push((si + 1) + '|' + id); break; }
    }
  }
});
console.log(out.join('\n'));
console.error('共 ' + out.length + ' 条斜线边');
