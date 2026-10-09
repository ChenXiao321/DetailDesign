// 用法: node _edge_diff.js <旧报告.html> <新报告.html>
// ① 每份报告统计「可见 flowchart 边中的斜线段」（排除 ~~~ 隐形钉位）;
// ② 对比两报告所有 flowchart 边的 d 属性，列出变化的边 id（按 svg 序号）。
const fs = require('fs');

const extract = (file) => {
  const html = fs.readFileSync(file, 'utf8');
  const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  // 边: id 与 class 顺序不定，先抓整个 <path ...> 标签再解析
  const edges = new Map(); // key = svgIdx + '|' + id
  svgs.forEach((svg, si) => {
    for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
      const tag = m[0];
      if (!/class="[^"]*flowchart-link/.test(tag)) continue;
      const idm = tag.match(/id="([^"]+)"/);
      const dm = tag.match(/d="([^"]+)"/);
      if (!idm || !dm) continue;
      const invisible = /edge-thickness-invisible/.test(tag);
      edges.set(si + '|' + idm[1], { d: dm[1], invisible, svg: si });
    }
  });
  return { svgs: svgs.length, edges };
};

const diagSegs = (d) => {
  const pts = [...d.matchAll(/([-\d.]+)[ ,]([-\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    if (Math.abs(pts[i + 1][0] - pts[i][0]) > 0.6 && Math.abs(pts[i + 1][1] - pts[i][1]) > 0.6) n++;
  }
  return n;
};

const diagList = (r) => {
  const out = [];
  for (const [k, v] of r.edges) {
    if (v.invisible) continue;
    const n = diagSegs(v.d);
    if (n > 0) out.push({ key: k, segs: n });
  }
  return out;
};

const a = extract(process.argv[2]), b = extract(process.argv[3]);
console.log('旧: ' + a.svgs + ' svg, ' + a.edges.size + ' 边;  新: ' + b.svgs + ' svg, ' + b.edges.size + ' 边');
const da = diagList(a), db = diagList(b);
console.log('斜线边: 旧 ' + da.length + ' → 新 ' + db.length);
console.log('--- 新报告仍斜线的边 ---');
for (const x of db) console.log('  ' + x.key + ' (' + x.segs + ' 段斜)');
console.log('--- 变化的边（新 vs 旧）---');
let changed = 0, changedCleanOld = 0;
for (const [k, v] of b.edges) {
  const old = a.edges.get(k);
  if (!old) { console.log('  新增 ' + k); changed++; continue; }
  if (old.d !== v.d) {
    changed++;
    const wasDiag = diagSegs(old.d) > 0;
    if (!wasDiag && !old.invisible) { changedCleanOld++; console.log('  ⚠ 原为直角却被改动: ' + k); }
  }
}
for (const k of a.edges.keys()) if (!b.edges.has(k)) { console.log('  消失 ' + k); changed++; }
console.log('共 ' + changed + ' 条边变化；其中原为直角可见边却被改动的: ' + changedCleanOld + (changedCleanOld ? '  ← 回归!' : '（零回归）'));
