// 验证：else 被 #endif 夹断时菱形归属虚线框（Startup L607-629 三明治场景）
const fs = require('fs');
const { buildStaticFlowchart } = require('./packages/core/dist/generator/staticFlowchart.js');

(async () => {
  const file = '测试模块/Gp_EcuStpStdn/Gp_EcuStpShdn.c';
  const source = fs.readFileSync(file, 'utf8');
  const fn = { name: 'Gp_EcuStpShdn_Startup', file, lineStart: 484, conditionalFlags: [], bodyText: '' };
  const r = await buildStaticFlowchart(fn, source);

  // 找 TryPwrShdn / SafeState 菱形 id
  const d5 = r.mermaid.match(/^(    )?(D\d+)\{"[^"]*TryPwrShdn_b/m);
  const d6 = r.mermaid.match(/^(    )?(D\d+)\{"[^"]*SafeState_b/m);
  const did5 = d5 && d5[2], did6 = d6 && d6[2];
  console.log('菱形:', did5, did6);

  // 检查菱形是否声明在 subgraph 内（嵌套块里按缩进/块内出现判定）
  const sg3 = r.mermaid.match(/subgraph SG3_0[\s\S]*?\n    end/);
  const inBox = (id) => {
    if (!id) return false;
    // 抓所有 subgraph 块文本，看 id 声明是否落在其中
    const blocks = r.mermaid.match(/subgraph SG[\s\S]*?^\s*end/gm) || [];
    return blocks.some(b => new RegExp(`^\\s*${id}[\\{\\[]`, 'm').test(b));
  };
  console.log(did5, '在虚线框内:', inBox(did5));
  console.log(did6, '在虚线框内:', inBox(did6));
  console.log('framedMacros:', r.framedMacros);
  console.log('warnings:', r.warnings);

  // 对比旧 v5 产物：除该函数外 mermaid 应零变化（后面 E2E 再全量对）
  const out = [];
  const lines = r.mermaid.split('\n');
  const keep = lines.filter(l => /D5|D6|SG3|SG4|N27|N28/.test(l));
  console.log(keep.join('\n'));
  process.exitCode = inBox(did5) && inBox(did6) ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
