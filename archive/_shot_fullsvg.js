// 从渲染后报告抽出 Startup 流程图 svg，整图截图
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, outPng] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const hits = svgs.filter(s => s.includes('junction-dot') && s.includes('生效时参与编译'));
const heightOf = s => +(s.match(/viewBox="([-0-9\s.,]+)"/)[1].split(/[\s,]+/)[3]);
const hit = hits.reduce((a, b) => heightOf(b) > heightOf(a) ? b : a);
const vb = hit.match(/viewBox="([-0-9\s.,]+)"/)[1].split(/[\s,]+/).map(Number);
const W = Math.ceil(vb[2]) + 20, H = Math.ceil(vb[3]) + 20;
const svg = hit
  .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, '$1 width="' + W + '"')
  .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1 height="' + H + '"');
const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + svg + '</body></html>';
fs.writeFileSync(outPng + '.html', page, 'utf-8');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + path.resolve(outPng),
  '--window-size=' + W + ',' + H, '--virtual-time-budget=8000',
  'file:///' + path.resolve(outPng + '.html').replace(/\\/g, '/')], { stdio: 'pipe' });
fs.unlinkSync(outPng + '.html');
console.log('saved', outPng, W + 'x' + H);
