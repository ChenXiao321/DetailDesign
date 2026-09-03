// 把双审计脚本复制到 内网测试/<mod>_qwen/ 并就地执行
const fs = require('fs');
const { execFileSync } = require('child_process');
const SRC = '测试产出/Gp_TLF35584_5.0.3';
for (const d of ['内网测试/Gp_EcuStpStdn_qwen', '内网测试/Gp_IoMcuAdc_qwen', '内网测试/Gp_TLF35584_qwen']) {
  let xc = fs.readFileSync(`${SRC}/_xcheck.js`, 'utf8');
  // 路径改为脚本所在目录的 lld_report.html
  xc = xc.replace(/fs\.readFileSync\('[^']*lld_report\.html'/, "fs.readFileSync(__dirname + '/lld_report.html'");
  fs.writeFileSync(`${d}/_xcheck.js`, xc);
  fs.copyFileSync(`${SRC}/_arrowcheck.js`, `${d}/_arrowcheck.js`);
  console.log(`\n===== ${d} _xcheck =====`);
  try { console.log(execFileSync('node', [`${d}/_xcheck.js`], { encoding: 'utf8' }).trim()); }
  catch (e) { console.log('XCHECK 非零退出:\n' + (e.stdout ?? '') + (e.stderr ?? '')); }
  console.log(`===== ${d} _arrowcheck =====`);
  try { console.log(execFileSync('node', [`${d}/_arrowcheck.js`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()); }
  catch (e) { console.log('ARROWCHECK 非零退出:\n' + (e.stdout ?? '') + (e.stderr ?? '')); }
}
