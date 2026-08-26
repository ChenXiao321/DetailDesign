// 分类违规边：打印违规边的点数/路径 + 被穿盒的节点形状（rect or polygon+points）
const fs = require('fs');
const html = fs.readFileSync('测试产出/Gp_TLF35584_5.0.3/lld_report.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const want = {
  45: { edges: ['L_I1_D1_4', 'L_D2_END_12'], boxes: ['T', 'B2'] },
  51: { edges: ['L_D0_END_20'], boxes: ['C1', 'D1'] },
  54: { edges: ['L_D0_END_24'], boxes: ['C1', 'D1'] },
};
for (const si in want) {
  const svg = svgs[si];
  console.log(`=== svg#${si} ===`);
  const w = want[si];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const im = tag.match(/id="(L_[^"]+)"/);
    if (!im || !w.edges.includes(im[1])) continue;
    const dm = tag.match(/d="([^"]+)"/);
    console.log('边', im[1], dm[1]);
  }
  const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+" transform="translate\((-?[\d.]+), (-?[\d.]+)\)"([\s\S]*?)(?=<g class="node|<g class="edgeLabel|<\/svg>)/g;
  let gm;
  while ((gm = gRe.exec(svg))) {
    if (!w.boxes.includes(gm[1])) continue;
    const body = gm[4];
    const pm = body.match(/<polygon points="([^"]+)"[^>]*transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/);
    const rm = body.match(/<rect[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    console.log('节点', gm[1], 'at', gm[2], gm[3], pm ? 'polygon ' + pm[1] + ' @' + pm[2] + ',' + pm[3] : rm ? 'rect ' + rm.slice(1).join(',') : '?');
  }
}
