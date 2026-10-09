// 阳/阴性语料验证 lintFlowchartStructure
const fs = require('fs');
const { lintFlowchartStructure } = require('../packages/core/dist/report/mermaidPre.js');

function flowchartsOf(path) {
  const d = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const out = {};
  for (const f of [...(d.providedFunctions || []), ...(d.internalFunctions || [])])
    if (f.generated?.flowchart) out[`${f.name}`] = f.generated.flowchart;
  return out;
}

let fail = 0;

// ===== 阳性：必须检出 =====
console.log('===== 阳性语料（应检出） =====');
const posCases = [
  // [来源, 文件, 函数名过滤, 期望命中的关键词]
  ['START悬空', '内网测试/Gp_TLF35584_qwen/lld_design.bak5-本地修图前.json', 'SinSafetyBistCheck', '开始节点'],
  ['START悬空', '内网测试/Gp_TLF35584_qwen/lld_design.bak5-本地修图前.json', 'AllSafetyBistCheck', '开始节点'],
  ['DEM孤儿', '内网测试/Gp_TLF35584_qwen/lld_design.bak5-本地修图前.json', 'TransmitData', '孤儿'],
  ['是否同目标', '内网测试/Gp_EcuStpStdn_qwen/lld_design.bak6-mainfunc修前.json', 'Mainfunction', '同一节点'],
];
for (const [tag, file, fn, expect] of posCases) {
  const fc = flowchartsOf(file);
  const name = Object.keys(fc).find(n => n.includes(fn));
  const problems = lintFlowchartStructure(fc[name]);
  const hit = problems.some(p => p.includes(expect));
  console.log(`${hit ? 'PASS' : 'FAIL'} [${tag}] ${name}: ${problems.length} 问题${hit ? '' : '，未命中「' + expect + '」'}`);
  if (!hit) { fail++; console.log('  实际:', problems); }
}

// 手工阳性：--> subgraph / 伪别名 / 空目标
const handmade = [
  ['--> subgraph', 'flowchart TD\n  A["x"] --> SG1\n  subgraph SG1[" "]\n    B["y"]\n  end\n  B --> C(["结束"])', 'subgraph'],
  ['伪别名', 'flowchart TD\n  A(["开始"]) --> B["x"]\n  C = B\n  B --> D(["结束"])', '别名'],
  ['空目标', 'flowchart TD\n  A(["开始"]) --> B["x"]\n  B -- 是 -->\n  B --> C(["结束"])', '缺目标'],
];
for (const [tag, src, expect] of handmade) {
  const problems = lintFlowchartStructure(src);
  const hit = problems.some(p => p.includes(expect));
  console.log(`${hit ? 'PASS' : 'FAIL'} [手工:${tag}]`);
  if (!hit) { fail++; console.log('  实际:', problems); }
}

// ===== 阴性：零误报 =====
console.log('\n===== 阴性语料（应零误报） =====');
const negFiles = [
  '内网测试/Gp_EcuStpStdn_qwen/lld_design.json',
  '内网测试/Gp_IoMcuAdc_qwen/lld_design.json',
  '内网测试/Gp_TLF35584_qwen/lld_design.json',
  '测试产出/Gp_EcuStpStdn/lld_design.json',
  '测试产出/Gp_IoMcuAdc_3.2.0/lld_design.json',
  '测试产出/Gp_TLF35584_5.0.3/lld_design.json',
];
let total = 0, flagged = 0;
for (const f of negFiles) {
  for (const [name, src] of Object.entries(flowchartsOf(f))) {
    total++;
    const problems = lintFlowchartStructure(src);
    if (problems.length > 0) {
      flagged++;
      console.log(`FALSE+ ${f} :: ${name}`);
      problems.forEach(p => console.log('   - ' + p));
    }
  }
}
console.log(`阴性 ${total} 图，误报 ${flagged}`);
console.log(fail === 0 && flagged === 0 ? '\nALL GREEN' : '\nHAS FAILURES');
