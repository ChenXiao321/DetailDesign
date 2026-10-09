// 对照：交付版 vs qwen 渲染版，svg#0（文件包含图，analyzer 生成、内容应一致）的边路径
const fs = require('fs');
const old = fs.readFileSync('测试产出/Gp_IoMcuAdc_3.2.0/lld_report.html', 'utf8');
const nw = fs.readFileSync('内网测试/Gp_IoMcuAdc_qwen/lld_report.html', 'utf8');
const svgOf = (html, n) => [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0])[n];
const o0 = svgOf(old, 0), n0 = svgOf(nw, 0);
console.log('svg#0 存在性:', !!o0, !!n0);
const edgesOf = (svg) => {
  const out = {};
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const dm = tag.match(/d="([^"]+)"/);
    const im = tag.match(/id="(L_[^"]+)"/);
    if (dm && im) out[im[1]] = dm[1];
  }
  return out;
};
const oe = edgesOf(o0), ne = edgesOf(n0);
console.log('边数: 交付', Object.keys(oe).length, ' qwen', Object.keys(ne).length);
for (const id of Object.keys(ne)) {
  const same = oe[id] === ne[id];
  console.log(`${same ? '同' : '异'} ${id}`);
  if (!same) {
    console.log('  交付:', (oe[id] ?? '(无)').slice(0, 110));
    console.log('  qwen:', ne[id].slice(0, 110));
  }
}
