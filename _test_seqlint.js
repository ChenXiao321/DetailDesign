// 对全库 design json 的序列图跑 lintSequenceStructure，验证：TLF/IoM 零片段图被拦、基线零误报
const fs = require('fs');
const path = require('path');
const { lintSequenceStructure } = require('./packages/core/dist/report/mermaidPre.js');

const dirs = [
  '测试产出/Gp_EcuStpStdn',
  '测试产出/Gp_IoMcuAdc_3.2.0',
  '测试产出/Gp_TLF35584_5.0.3',
  '内网测试/Gp_EcuStpStdn_qwen',
  '内网测试/Gp_EcuStpStdn_qwen_v2',
  '内网测试/Gp_IoMcuAdc_qwen',
  '内网测试/Gp_TLF35584_qwen',
];
let total = 0, flagged = 0;
for (const dir of dirs) {
  const p = path.join(dir, 'lld_design.json');
  if (!fs.existsSync(p)) { console.log('SKIP', dir); continue; }
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const seqs = (d.dynamicDesign && d.dynamicDesign.sequences) || [];
  for (const s of seqs) {
    const ps = lintSequenceStructure(s.diagram || '');
    total++;
    if (ps.length) {
      flagged++;
      console.log(`FLAG ${dir} :: ${s.name}${s.role ? '/' + s.role : ''}`);
      ps.forEach(x => console.log('   -', x.slice(0, 90)));
    }
  }
}
console.log(`---- ${total} 张序列图, ${flagged} 张被标记`);
