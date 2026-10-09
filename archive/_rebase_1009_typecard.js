// 基线重刷（2026-10-09 类型卡片两表合一）：8 产物重新生成 lld_report_src.html；
// 先验证差异仅限 ①新增 CSS 行 .wi-table.type-merged ②5.2.1.2 数据类型定义节，通过才覆盖基线
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
const CSS = '.wi-table.type-merged td { border:1px solid var(--border); }';
const HEAD = '5.2.1.2 数据类型定义';
const TAIL = '<h3 id="s522"';
const tmp = '_regress_tmp';
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
  const basePath = path.join(p, 'lld_report_src.html');
  if (!fs.existsSync(basePath)) { console.log(`!! ${p} 缺基线`); bad++; continue; }
  execFileSync('node', ['packages/cli/dist/index.js', 'report', '测试模块', '--out', out],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  const a = fs.readFileSync(path.join(out, 'lld_report.html'), 'utf8');
  const b = fs.readFileSync(basePath, 'utf8');
  const iA = a.indexOf(HEAD), iB = b.indexOf(HEAD);
  const jA = a.indexOf(TAIL), jB = b.indexOf(TAIL);
  const prefixOk = iA > 0 && iB > 0 && a.slice(0, iA).replace(CSS + '\n', '') === b.slice(0, iB);
  const suffixOk = jA > 0 && jB > 0 && a.slice(jA) === b.slice(jB);
  if (prefixOk && suffixOk) {
    fs.copyFileSync(path.join(out, 'lld_report.html'), basePath);
    console.log(`✓ 已重刷 ${p}（new=${Buffer.byteLength(a)} base=${Buffer.byteLength(b)}）`);
  } else {
    console.log(`✗ 越界差异 ${p}（prefixOk=${prefixOk} suffixOk=${suffixOk}），未覆盖`);
    bad++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
