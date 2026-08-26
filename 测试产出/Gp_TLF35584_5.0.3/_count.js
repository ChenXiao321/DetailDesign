// 统计两份报告的边解析数与 box 解析数
const fs = require('fs');
for (const dir of ['Gp_EcuStpStdn', 'Gp_TLF35584_5.0.3']) {
  const html = fs.readFileSync(`测试产出/${dir}/lld_report.html`, 'utf-8');
  const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
  let edges = 0, boxes = 0, zeroEdge = 0;
  for (const svg of svgs) {
    let n = 0;
    for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
      const tag = m[0];
      if (/d="[^"]+"/.test(tag) && /id="L_[^"]+"/.test(tag)) n++;
    }
    edges += n;
    if (n === 0 && /class="node/.test(svg)) zeroEdge++;
    const gRe = /<g class="node[^"]*" id="flowchart-([A-Za-z0-9_]+)-\d+"/g;
    boxes += (svg.match(gRe) || []).length;
  }
  console.log(dir, `svg=${svgs.length} 边=${edges} 节点=${boxes} 含节点但0边的图=${zeroEdge}`);
}
