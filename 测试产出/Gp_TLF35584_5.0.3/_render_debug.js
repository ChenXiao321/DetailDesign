// 调试渲染：带 #debug-orig 让页面把 dagre 原始路径存进 data-orig → _debug_orig.html
const fs = require('fs');
const { execFileSync } = require('child_process');
const BASE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const src = BASE + '/lld_report_src.html';
const url = 'file:///' + src.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':') + '#debug-orig';
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=20000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
fs.writeFileSync(BASE + '/_debug_orig.html', dump, 'utf-8');
console.log('debug rendered, data-orig count =', (dump.match(/data-orig/g) || []).length);
