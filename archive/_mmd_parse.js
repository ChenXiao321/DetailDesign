// 用 Edge 无头跑 mermaid.parse 拿精确报错行号。
// 用法: node _mmd_parse.js  → 解析三模块 design json 的全部图源，打印失败图的 parser 错误
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const diagrams = {};
for (const m of ['Gp_EcuStpStdn', 'Gp_IoMcuAdc', 'Gp_TLF35584']) {
  const d = JSON.parse(fs.readFileSync(`内网测试/${m}_qwen/lld_design.json`, 'utf-8'));
  for (const f of [...(d.providedFunctions || []), ...(d.internalFunctions || [])])
    if (f.generated?.flowchart) diagrams[`${m}/${f.name}`] = f.generated.flowchart;
  if (d.interfaceOverview?.diagram) diagrams[`${m}/overview`] = d.interfaceOverview.diagram;
  (d.callGraphs || []).forEach((g, i) => { if (g.diagram) diagrams[`${m}/callgraph${i}`] = g.diagram; });
  if (d.dynamicDesign?.stateMachine?.stateDiagram) diagrams[`${m}/stateMachine`] = d.dynamicDesign.stateMachine.stateDiagram;
  (d.dynamicDesign?.sequences || []).forEach(s => { diagrams[`${m}/seq:${s.name}`] = s.mermaid || s.diagram || ''; });
}

const mermaidJs = fs.readFileSync('packages/cli/assets/mermaid.min.js', 'utf-8');
const tmp = path.join(process.env.TEMP, '_mmd_parse.html');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<pre id="out">PENDING</pre>
<script>${mermaidJs}</script>
<script>
const D = ${JSON.stringify(diagrams)};
(async () => {
  const results = {};
  for (const [id, src] of Object.entries(D)) {
    try { await mermaid.parse(src); results[id] = null; }
    catch (e) { results[id] = String(e && e.message || e).slice(0, 800); }
  }
  document.getElementById('out').textContent = JSON.stringify(results);
})();
</script></body></html>`;
fs.writeFileSync(tmp, html, 'utf-8');

const url = 'file:///' + tmp.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=30000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
const m = dump.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) { console.log('NO RESULT'); process.exit(1); }
const results = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
let bad = 0;
for (const [id, err] of Object.entries(results)) {
  if (err) { bad++; console.log(`\n### ${id}\n${err}`); }
}
console.log(`\n共 ${Object.keys(results).length} 图, 解析失败 ${bad}`);
