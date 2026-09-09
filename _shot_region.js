// 从渲染后报告抽 svg，把 viewBox 钳到指定 data-junction 圆点周围再截图
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, svgNeedle, jId, halfW, halfH, outPng] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const hit = svgs.find(s => s.includes(svgNeedle) && /viewBox="[-\d\s.,]+"/.test(s));
if (!hit) { console.error('svg not found'); process.exit(1); }
const dm = hit.match(new RegExp('<circle[^>]*class="junction-dot"[^>]*data-junction="' + jId + '"[^>]*>'));
if (!dm) { console.error('junction dot not found'); process.exit(1); }
const cx = +dm[0].match(/cx="(-?[\d.]+)"/)[1], cy = +dm[0].match(/cy="(-?[\d.]+)"/)[1];
const hw = +halfW, hh = +halfH;
const svg = hit.replace(/viewBox="[^"]+"/, 'viewBox="' + (cx - hw) + ' ' + (cy - hh) + ' ' + 2 * hw + ' ' + 2 * hh + '"')
  .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, '$1 width="' + 2 * hw + '"')
  .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1 height="' + 2 * hh + '"');
const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>' + svg + '</body></html>';
const tmp = outPng + '.html';
fs.writeFileSync(tmp, page, 'utf-8');
const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + outPng,
  '--window-size=' + 2 * hw + ',' + 2 * hh, '--virtual-time-budget=8000', url], { stdio: 'pipe' });
fs.unlinkSync(tmp);
console.log('saved', outPng, 'around', jId, cx.toFixed(1), cy.toFixed(1));
