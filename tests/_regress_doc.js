// 新路径验证：8 产物复制到临时目录 → gen --only document --resume（免LLM）→ report → 与基线字节比对
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
const tmp = '_regress_doc_tmp';
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
  if (!fs.existsSync(base)) { console.log(`!! ${p} 缺基线`); bad++; continue; }
  execFileSync('node', ['packages/cli/dist/index.js', 'gen', '测试模块', '--out', out,
    '--only', 'document', '--resume'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const dj = JSON.parse(fs.readFileSync(path.join(out, 'lld_design.json'), 'utf-8'));
  if (!dj.document) { console.log(`✗ ${p} document 节未写入`); bad++; continue; }
  execFileSync('node', ['packages/cli/dist/index.js', 'report', '测试模块', '--out', out],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  const a = fs.readFileSync(path.join(out, 'lld_report.html'));
  const b = fs.readFileSync(base);
  console.log(`${a.equals(b) ? '✓' : '✗ 不一致'} ${p}（new=${a.length} base=${b.length}）abbr=${dj.document.abbreviations.length} gaps=${dj.document.abbreviationGaps.length}`);
  if (!a.equals(b)) bad++;
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
