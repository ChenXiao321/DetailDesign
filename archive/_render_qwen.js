// 渲染 内网测试/<dir>/lld_report_src.html（=刚生成的源版）→ lld_report.html，并诊断 ORTHO 是否执行
const fs = require('fs');
const { execFileSync } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const dir = process.argv[2]; // 如 内网测试/Gp_TLF35584_qwen
const src = `${process.cwd()}/${dir}/lld_report_src.html`;
// 源版备份：lld report 刚出的 lld_report.html 即源版
fs.copyFileSync(`${process.cwd()}/${dir}/lld_report.html`, src);
const url = 'file:///' + src.replace(/\\/g, '/').replace(/#/g, '%23')
  .split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':');
const dump = execFileSync(EDGE, ['--headless', '--disable-gpu', '--dump-dom',
  '--virtual-time-budget=20000', url], { maxBuffer: 64 * 1024 * 1024 }).toString('utf-8');
fs.writeFileSync(`${process.cwd()}/${dir}/lld_report.html`, dump, 'utf-8');
console.log('rendered, svg count =', (dump.match(/<svg/g) || []).length);
// 诊断①：mermaid 语法错误块（渲染失败会留下 error 元素/文本）
const errCount = (dump.match(/mermaid version|Syntax error|error-icon|error-text/gi) || []).length;
console.log('mermaid 错误标记 =', errCount);
// 诊断②：ORTHO 是否执行——data-processed 标记或直接看边路径形态
console.log('data-processed 数 =', (dump.match(/data-processed/g) || []).length);
// 诊断③：抽查边 d 属性——直角化后只含 M/L 命令；dagre 原始含 C/L 混合或斜 L
// 坑：flowchart 边属性顺序是 d 在前 class 在后，两种顺序都要匹配，否则只数到序列图边
const ds = [...dump.matchAll(/<path[^>]*class="[^"]*flowchart-link[^"]*"[^>]*d="([^"]+)"/g)].map(m => m[1])
  .concat([...dump.matchAll(/<path[^>]*d="([^"]+)"[^>]*class="[^"]*flowchart-link[^"]*"/g)].map(m => m[1]));
let ortho = 0, diag = 0;
for (const d of ds) {
  const segs = [...d.matchAll(/L(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);
  let prev = d.match(/M(-?[\d.]+)[ ,](-?[\d.]+)/);
  let isOrtho = true;
  if (prev) {
    let p = [+prev[1], +prev[2]];
    for (const q of segs) {
      if (Math.abs(q[0] - p[0]) > 0.6 && Math.abs(q[1] - p[1]) > 0.6) { isOrtho = false; break; }
      p = q;
    }
  }
  if (d.includes('C')) isOrtho = false;
  isOrtho ? ortho++ : diag++;
}
console.log(`边路径: 直角 ${ortho} / 非直角 ${diag} / 共 ${ds.length}`);
