// 从渲染后报告抽 svg，把 viewBox 钳到指定文本节点周围再截图（用于虚线框归属目检）
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, svgNeedle, textNeedle, halfW, halfH, outPng] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const hit = svgs.find(s => s.includes(svgNeedle) && s.includes('junction-dot')); // 流程图才有 junction-dot
if (!hit) { console.error('svg not found'); process.exit(1); }
// 文本在 foreignObject 深层，先定位文本出现处，再回溯最近的节点 transform
const ti = hit.indexOf(textNeedle);
if (ti === -1) { console.error('text not in svg'); process.exit(1); }
const before = hit.slice(0, ti);
const tm = [...before.matchAll(/transform="translate\((-?[\d.]+)[,\s]+(-?[\d.]+)\)"/g)].pop();
if (!tm) { console.error('text node not found'); process.exit(1); }
const found = { x: +tm[1], y: +tm[2] };
const hw = +halfW, hh = +halfH;
// 节点盒中心 ≈ 平移点（mermaid flowchart 节点 translate 即中心）
const svg = hit.replace(/viewBox="[^"]+"/, 'viewBox="' + (found.x - hw) + ' ' + (found.y - hh) + ' ' + 2 * hw + ' ' + 2 * hh + '"')
  .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, '$1 width="' + 2 * hw + '"')
  .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1 height="' + 2 * hh + '"');
const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + svg + '</body></html>';
const tmp = outPng + '.html';
fs.writeFileSync(tmp, page, 'utf-8');
const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + outPng,
  '--window-size=' + 2 * hw + ',' + 2 * hh, '--virtual-time-budget=8000', url], { stdio: 'pipe' });
fs.unlinkSync(tmp);
console.log('saved', outPng, 'around', textNeedle, found.x.toFixed(1), found.y.toFixed(1));
