// 一次性：抽报告的 5.3.1.1/5.3.1.2 表格段，带报告样式截图
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, outPng] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, 'utf-8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const sec = html.match(/<h3>5\.3\.1\.1[\s\S]*?5\.3\.1\.2[\s\S]*?<\/table>/)?.[0];
if (!sec) { console.error('5.3.1.1 section not found'); process.exit(1); }
const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + style + ' body{padding:16px}</style></head><body>' + sec + '</body></html>';
const tmp = outPng + '.html';
fs.writeFileSync(tmp, page, 'utf-8');
const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + outPng,
  '--window-size=1100,900', '--virtual-time-budget=8000', url], { stdio: 'pipe' });
fs.unlinkSync(tmp);
console.log('saved', outPng);
