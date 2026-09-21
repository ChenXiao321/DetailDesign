// 一次性：从渲染后报告抽出含指定文本的 svg，Edge 截图成 PNG 目检
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [htmlPath, needle, outPng] = process.argv.slice(2);

const html = fs.readFileSync(htmlPath, 'utf-8');
const svgs = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
svgs.forEach((s, i) => {
  if (s.includes(needle)) {
    const vb = s.match(/viewBox="([^"]+)"/);
    console.log('candidate svg#' + i, 'len=' + s.length, 'viewBox=' + (vb && vb[1]));
  }
});
// needle 可能命中多张（调用图也含函数名），取文档序最后一张（流程图是长图）
const hits = svgs.filter(s => s.includes(needle) && /viewBox="[-\d\s.,]+"/.test(s));
const heightOf = s => +(s.match(/viewBox="([-0-9\s.,]+)"/)?.[1]?.split(/[\s,]+/) ?? [0, 0, 0, 0])[3];
const hit = hits.length ? hits[hits.length - 1] : null;
if (!hit) { console.error('未找到含 ' + needle + ' 的 svg'); process.exit(1); }
console.log('picked svg#' + svgs.indexOf(hit));
const vb = hit.match(/viewBox="([^"]+)"/);
const [x, y, w, h] = vb ? vb[1].split(/[\s,]+/).map(Number) : [0, 0, 800, 600];
const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}</style></head><body>${hit}</body></html>`;
const tmp = outPng + '.html';
fs.writeFileSync(tmp, page, 'utf-8');
const url = 'file:///' + tmp.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
execFileSync(EDGE, ['--headless', '--disable-gpu', '--screenshot=' + outPng,
  '--window-size=' + Math.ceil(w + 40) + ',' + Math.ceil(h + 40),
  '--force-device-scale-factor=2', '--virtual-time-budget=5000', url]);
fs.unlinkSync(tmp);
console.log('saved', outPng, Math.ceil(w) + 'x' + Math.ceil(h));
