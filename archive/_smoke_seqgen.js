// 冒烟：真实 EcuStpStdn 源码 → 静态序列图，对照 v6_序列图修正 基准
const fs = require('fs');
const path = require('path');
const { buildStaticSequence } = require('./packages/core/dist/generator/staticSequence.js');

const MOD = '测试模块/Gp_EcuStpStdn';
const design = JSON.parse(fs.readFileSync('内网测试/v6_序列图修正/lld_design.json', 'utf-8'));

// 构造最小 ModuleModel（参与者解析需要 providedFunctions/internalFunctions/calledExternalFunctions）
const model = {
  module: design.module,
  providedFunctions: design.providedFunctions,
  internalFunctions: design.internalFunctions,
  calledExternalFunctions: design.calledExternalFunctions,
};
const readSource = (rel) => {
  try { return fs.readFileSync(path.join(MOD, rel), 'utf-8'); } catch { return null; }
};

(async () => {
  for (const pat of [/_(Startup|Init)$/i, /_MainFunction$/i]) {
    const fn = design.providedFunctions.find(f => pat.test(f.name));
    if (!fn) { console.log('!! 未找到', pat); continue; }
    const out = await buildStaticSequence(model, fn, readSource);
    console.log(`\n######## ${fn.name} (degraded=${out.degraded})`);
    for (const w of out.warnings) console.log('  ⚠', w);
    for (const p of out.parts) {
      console.log(`\n===== ${p.role ?? '单图'} =====`);
      console.log(p.diagram);
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
