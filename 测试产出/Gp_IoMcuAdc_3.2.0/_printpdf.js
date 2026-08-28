// 用 Edge 无头把 lld_report.html 打印成 _lld_report_new.pdf（调用方负责 mv 替换）
const { execFileSync } = require('child_process');
const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const src = BASE + '/lld_report.html';
const out = BASE + '/_lld_report_new.pdf';
const url = 'file:///' + src.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--no-pdf-header-footer',
  '--print-to-pdf=' + out, url], { maxBuffer: 64 * 1024 * 1024 });
const sz = require('fs').statSync(out).size;
console.log('pdf bytes =', sz);
if (sz < 500000) { console.error('PDF 异常小，可能打印了错误页'); process.exit(1); }
