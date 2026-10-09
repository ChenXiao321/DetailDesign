// 统一测试入口：npm test 跑全部 12 套件；npm run test:gate 追加双字节门禁（慢，~3min）
// 约定：一律从仓库根目录运行（产物/基线路径为 cwd 相对）
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  '_test_abbrdocx.js', '_test_cfggen.js', '_test_condlint.js', '_test_doccontent.js',
  '_test_dynamic_skip.js', '_test_fclint.js', '_test_glossary.js', '_test_imgbatch.js',
  '_test_schemalint.js', '_test_seqgen.js', '_test_seqlint.js', '_test_smsgen.js',
];
const GATES = ['_regress_byte.js', '_regress_doc.js'];

const withGates = process.argv.includes('--gate');
const list = withGates ? [...SUITES, ...GATES] : SUITES;
let bad = 0;
for (const s of list) {
  const r = spawnSync('node', [path.join('tests', s)], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  if (r.status !== 0) { console.error(`✗ ${s} 退出码 ${r.status}`); bad++; }
}
console.log(bad === 0
  ? `\n全部通过 ✓（${list.length} 项${withGates ? '，含字节门禁' : ''}）`
  : `\n✗ ${bad} 项失败`);
process.exit(bad ? 1 : 0);
