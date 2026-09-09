// 对内网新规产物 v2 跑 lintFlowchartStructure 阴性验证
const fs = require('fs');
const { lintFlowchartStructure, lintMermaidSource } = require('./packages/core/dist/report/mermaidPre.js');
const d = JSON.parse(fs.readFileSync('内网测试/Gp_EcuStpStdn_qwen_v2/lld_design.json', 'utf-8'));
let total = 0, flagged = 0;
for (const f of [...d.providedFunctions, ...d.internalFunctions]) {
  const src = f.generated?.flowchart;
  if (!src) continue;
  total++;
  const probs = [...lintMermaidSource(src), ...lintFlowchartStructure(src)];
  if (probs.length) { flagged++; console.log(`FLAG ${f.name}:`); probs.forEach(p => console.log('  - ' + p)); }
}
console.log(`\n${total} 图，flagged ${flagged}`);
console.log(flagged === 0 ? 'ALL GREEN' : 'HAS FLAGS');
