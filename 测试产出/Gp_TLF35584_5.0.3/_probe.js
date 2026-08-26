// 探查指定 svg 的边路径与节点盒
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/lld_report.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const si = +process.argv[2];
const svg = svgs[si];
console.log('--- svg#' + si + ' ---');
for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
  const tag = m[0];
  const dm = tag.match(/d="([^"]+)"/);
  const im = tag.match(/id="(L_[^"]+)"/);
  if (!dm || !im) continue;
  console.log(im[1], dm[1].slice(0, 160));
}
console.log('--- 节点 ---');
const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+" transform="translate\((-?[\d.]+), (-?[\d.]+)\)"([\s\S]*?)(?=<g class="node|<g class="edgeLabel|<\/svg>)/g;
let gm;
while ((gm = gRe.exec(svg))) {
  const id = gm[1], tx = +gm[2], ty = +gm[3], body = gm[4];
  const rm = body.match(/<rect[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
  const pm = body.match(/<polygon points="([^"]+)"[^>]*transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
  let box;
  if (rm) box = [+rm[1] + tx, +rm[2] + ty, +rm[3], +rm[4]];
  else if (pm) {
    const pp = [...pm[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(q => [+q[1] + +pm[2] + tx, +q[2] + +pm[3] + ty]);
    box = [Math.min(...pp.map(p => p[0])), Math.min(...pp.map(p => p[1])), Math.max(...pp.map(p => p[0])) - Math.min(...pp.map(p => p[0])), Math.max(...pp.map(p => p[1])) - Math.min(...pp.map(p => p[1]))];
  }
  const label = (body.match(/<span class="nodeLabel"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
  console.log(id, box ? box.map(v => v.toFixed(1)).join(',') : '?', (label || '').replace(/<[^>]+>/g, ' ').slice(0, 40));
}
