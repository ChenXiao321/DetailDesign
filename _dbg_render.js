// 带 window.onerror 捕获重渲染 TLF qwen 源版，定位 ORTHO 崩溃点
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const dir = '内网测试/Gp_TLF35584_qwen';
const srcPath = `${process.cwd()}/${dir}/lld_report_src.html`;
let html = fs.readFileSync(srcPath, 'utf8');
// 尽早注入错误捕获（在 mermaid 脚本之前）
const hook = '<script>window.__errs=[];window.onerror=function(m,s,l,c){window.__errs.push(m+" @"+(s||"").split("/").pop()+":"+l+":"+c);document.documentElement.setAttribute("data-jserror",window.__errs.join(" ||| "));};</script>';
html = html.replace(/<head>/i, '<head>' + hook);
if (!html.includes('window.__errs')) { html = hook + html; }
const tmp = `${process.cwd()}/${dir}/_dbg_error.html`;
fs.writeFileSync(tmp, html);
const url = 'file:///' + tmp.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=20000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
const err = dump.match(/data-jserror="([^"]*)"/);
console.log('JS 错误:', err ? err[1] : '(无)');
// 顺带统计直角化是否发生
const flowEdges = [...dump.matchAll(/<path\b[^>]*>/g)].map(m => m[0])
  .filter(t => /flowchart-link/.test(t) && /id="L_/.test(t));
let diag = 0;
for (const t of flowEdges) {
  const d = (t.match(/d="([^"]+)"/) ?? [])[1] ?? '';
  const pts = [...d.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][0] - pts[i - 1][0]) > 0.6 && Math.abs(pts[i][1] - pts[i - 1][1]) > 0.6) { diag++; break; }
  }
}
console.log(`flowchart 边 ${flowEdges.length} 条，含斜段 ${diag} 条`);
