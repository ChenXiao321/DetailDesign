// 一次性：把修复后的分析字段（conditionalFlags/innerCondFlags/bodyTextWithPP）刷进 Qwen design json，
// 并清掉「基线有虚框而 Qwen 没画」的 24 张流程图，供内网 gen --only flowcharts --resume 重生成。
// 用法：node _refresh_condflags.js
const fs = require('fs');
const path = require('path');

const MODULES = [
  { tag: 'Gp_IoMcuAdc_qwen', model: `${process.env.TEMP}/lld_verify_iom/lld_model.json`, baseline: '测试产出/Gp_IoMcuAdc_3.2.0/lld_design.json' },
  { tag: 'Gp_TLF35584_qwen', model: `${process.env.TEMP}/lld_verify_tlf/lld_model.json`, baseline: '测试产出/Gp_TLF35584_5.0.3/lld_design.json' },
  { tag: 'Gp_EcuStpStdn_qwen', model: `${process.env.TEMP}/lld_verify_ecu/lld_model.json`, baseline: '测试产出/Gp_EcuStpStdn/lld_design.json' },
];

for (const m of MODULES) {
  const designPath = `内网测试/${m.tag}/lld_design.json`;
  const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));
  const fresh = JSON.parse(fs.readFileSync(m.model, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(m.baseline, 'utf8'));

  const freshFns = new Map([...fresh.providedFunctions, ...fresh.internalFunctions].map(f => [f.name, f]));
  const baseFns = new Map([...baseline.providedFunctions, ...baseline.internalFunctions].map(f => [f.name, f]));

  // 备份（保留此前所有手工补丁的版本）
  fs.copyFileSync(designPath, `内网测试/${m.tag}/lld_design.bak2.json`);

  const cleared = [];
  for (const fn of [...design.providedFunctions, ...design.internalFunctions]) {
    const nf = freshFns.get(fn.name);
    if (!nf) { console.log(`  ⚠ ${m.tag}/${fn.name} 在新模型中不存在，跳过`); continue; }
    fn.conditionalFlags = nf.conditionalFlags;
    if (nf.innerCondFlags) fn.innerCondFlags = nf.innerCondFlags; else delete fn.innerCondFlags;
    if (nf.bodyTextWithPP) fn.bodyTextWithPP = nf.bodyTextWithPP; else delete fn.bodyTextWithPP;

    const baseFc = baseFns.get(fn.name)?.generated?.flowchart ?? '';
    const qwenFc = fn.generated?.flowchart ?? '';
    if (baseFc.includes('condNote') && !qwenFc.includes('condNote')) {
      delete fn.generated.flowchart;
      delete fn.generated.flowchartFormat;
      cleared.push(fn.name);
    }
  }
  fs.writeFileSync(designPath, JSON.stringify(design, null, 2), 'utf8');
  console.log(`${m.tag}: 字段已刷新，清除流程图 ${cleared.length} 张`);
  for (const n of cleared) console.log(`  - ${n}`);
}
