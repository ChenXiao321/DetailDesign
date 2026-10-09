// 一次性：v8 全量预览——v7 预览 json（SM 已人工映射润色含 S/T 描述）+ 确定性序列图重刷，
// 产物 = 一份完整体现近期全部改动的报告（SM 结构/标签/描述 + 序列图结构/中文描述段）
// 序列图零 LLM 本地可跑；SM 保留 v7 json 里已润色的部分不动
const fs = require('fs');
const path = require('path');
const { buildStaticSequence } = require('./packages/core/dist/generator/staticSequence.js');

const SRC_MOD = '测试模块/Gp_EcuStpStdn';
const OUT_DIR = '内网测试/v8_全量预览/Gp_EcuStpStdn';

(async () => {
  const design = JSON.parse(fs.readFileSync('内网测试/v7_状态机静态生成预览/Gp_EcuStpStdn/lld_design.json', 'utf-8'));
  const model = {
    module: design.module,
    providedFunctions: design.providedFunctions,
    internalFunctions: design.internalFunctions,
    calledExternalFunctions: design.calledExternalFunctions,
  };
  const readSource = (rel) => {
    try { return fs.readFileSync(path.join(SRC_MOD, rel), 'utf-8'); } catch { return null; }
  };

  const scenarios = [
    { pattern: /_(Startup|Init)$/i, scenario: 'Initialization', label: '初始化' },
    { pattern: /_MainFunction$/i, scenario: 'Runtime', label: '周期运行' },
  ];
  const sequences = [];
  for (const { pattern, scenario, label } of scenarios) {
    const fn = design.providedFunctions.find(f => pattern.test(f.name));
    if (!fn) { console.log('!! 未找到', pattern); continue; }
    const out = await buildStaticSequence(model, fn, readSource, label);
    for (const w of out.warnings) console.log(`  ⚠ 序列图(${scenario}):`, w);
    if (out.degraded !== 'none') console.log(`  ⚠ 序列图(${scenario}): 降级级别 ${out.degraded}`);
    for (const part of out.parts) {
      const name = part.role ? `${scenario}（${part.role}）` : scenario;
      sequences.push({
        name, diagram: part.diagram, diagramFormat: 'mermaid', description: part.description,
        polarion: {
          isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence',
          title: part.role ? `${design.module} ${scenario} 序列图（${part.role}）` : `${design.module} ${scenario} 序列图`,
          workItemId: null,
        },
      });
    }
  }
  design.dynamicDesign.sequences = sequences;
  console.log(`序列图重刷 ${sequences.length} 张: ${sequences.map(s => s.name).join(' / ')}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'lld_design.json'), JSON.stringify(design, null, 1));
  console.log('json 已写入 ' + OUT_DIR);
})().catch(e => { console.error(e); process.exitCode = 1; });
