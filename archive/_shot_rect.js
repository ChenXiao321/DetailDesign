// 从渲染后报告抽第 n 张 svg，把 viewBox 钳到指定矩形再截图
// 用法: node _shot_rect.js <html> <svgIdx> <x> <y> <w> <h> <outPng>
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, idx, x, y, w, h, outPng, scale] = process.argv.slice(2);
const sc = +scale || 1;
const html = fs.readFileSync(htmlPath, 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const hit = svgs[+idx];
if (!hit) { console.error('svg not found'); process.exit(1); }
const svg = hit.replace(/viewBox="[^"]+"/, 'viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '"')
  .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, '$1 width="' + w * sc + '"')
  .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1 height="' + h * sc + '"');
const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + svg + '</body></html>';
const tmp = outPng + '.html';
fs.writeFileSync(tmp, page, 'utf-8');
const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + outPng,
  '--window-size=' + w * sc + ',' + h * sc, '--virtual-time-budget=8000', url], { stdio: 'pipe' });
fs.unlinkSync(tmp);
console.log('saved', outPng);
