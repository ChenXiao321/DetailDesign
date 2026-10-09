// 截 Startup 流程图 SG3/SG4 虚线框区域：定位第 2 个「生效时参与编译」（SG4 ACTION_ENABLE 注释）的节点位置
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const html = fs.readFileSync('_verify_fc/ecu/lld_report.html', 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const hits = svgs.filter(s => s.includes('生效时参与编译') && s.includes('junction-dot'));
const heightOf = s => +(s.match(/viewBox="([-0-9\s.,]+)"/)[1].split(/[\s,]+/)[3]);
const hit = hits.reduce((a, b) => heightOf(b) > heightOf(a) ? b : a);
// 所有注释出现位置 → 取 ACTION_ENABLE 那个（其前一定有 SAFETY_ACTIO 断行残片）
const occ = [];
let p = -1;
while ((p = hit.indexOf('生效时参与编译', p + 1)) !== -1) occ.push(p);
console.log('注释出现次数:', occ.length);
// 找含 ACTIO 残片的那个
let ti = occ.find(i => hit.slice(Math.max(0, i - 300), i).includes('ACTIO')) ?? occ[0];
const before = hit.slice(0, ti);
const tm = [...before.matchAll(/transform="translate\((-?[\d.]+)[,\s]+(-?[\d.]+)\)"/g)].pop();
const cx = +tm[1], cy = +tm[2];
console.log('SG4 注释节点中心:', cx, cy);
const hw = 800, hh = 750;
const outPng = process.argv[2];
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
console.log('saved', outPng);
