// 4.2 引导句括号删除：8 产物基线刷新（先验证唯一差异=该括号，再覆盖基线）
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const products = [
  '测试产出/Gp_EcuStpStdn',
  '测试产出/Gp_EcuStpStdn_qwen',
  '测试产出/Gp_IoMcuAdc_3.2.0',
  '测试产出/Gp_TLF35584_5.0.3',
  '内网测试/Gp_EcuStpStdn_qwen_v2',
  '内网测试/Gp_EcuStpStdn_qwen_v3',
  '内网测试/Gp_IoMcuAdc_qwen',
  '内网测试/Gp_TLF35584_qwen',
];
const BRACKET = '（由 #include 静态分析生成）';
const tmp = '_rebase_tmp';
fs.rmSync(tmp, { recursive: true, force: true });
let bad = 0;
for (const p of products) {
  const name = p.replace(/\//g, '_');
  const out = path.join(tmp, name);
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['lld_design.json', 'lld_model.json']) {
    const s = path.join(p, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(out, f));
  }
  const base = path.join(p, 'lld_report_src.html');
  execFileSync('node', ['packages/cli/dist/index.js', 'report', '测试模块', '--out', out],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  const newHtml = fs.readFileSync(path.join(out, 'lld_report.html'), 'utf8');
  const oldHtml = fs.readFileSync(base, 'utf8');
  const occurrences = oldHtml.split(BRACKET).length - 1;
  const normalized = oldHtml.split(BRACKET).join('');
  if (normalized === newHtml) {
    fs.writeFileSync(base, newHtml);
    console.log(`✓ ${p} 唯一差异=括号×${occurrences}，基线已刷新`);
  } else {
    console.log(`✗ ${p} 除括号外还有其他差异（括号×${occurrences}），未覆盖`);
    bad++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
