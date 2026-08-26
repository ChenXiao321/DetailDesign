// 用 Edge 无头渲染 lld_report_src.html（mermaid + ORTHO 后处理）→ lld_report.html
const fs = require('fs');
const { execFileSync } = require('child_process');
const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const src = BASE + '/lld_report_src.html';
const url = 'file:///' + src.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=20000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
fs.writeFileSync(BASE + '/lld_report.html', dump, 'utf-8');
console.log('rendered, svg count =', (dump.match(/<svg/g) || []).length);
