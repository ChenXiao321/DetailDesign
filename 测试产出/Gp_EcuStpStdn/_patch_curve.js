// mermaid.min.js 离线 bundle 补丁（重新下载/升级 mermaid 后必须重跑本脚本）：
// 1) 两处 insertEdge 默认插值 curveBasis(Do) -> curveLinear(Op)，
//    使 flowchart 边直接按 dagre 路径点画成折线（flowchart.curve 配置在此版本无效）。
// 2) destructEdgeType 默认末端箭头 arrow_point -> none，
//    使无箭头连线 --- 真正不画箭头（此版本把 arrow_open 也错误地画成带箭头）。
// 脚本幂等：已打过的补丁会跳过。
const fs = require('fs');
const path = 'packages/cli/assets/mermaid.min.js';
let s = fs.readFileSync(path, 'utf-8');

const subs = [
  ['let m=Do;e.curve&&(m=e.curve)', 'let m=Op;e.curve&&(m=e.curve)'],
  ['p=Do;r.curve&&(i==="graph"||i==="flowchart")&&(p=r.curve)', 'p=Op;r.curve&&(i==="graph"||i==="flowchart")&&(p=r.curve)'],
  ['E9e=o(t=>{let e="none",r="arrow_point";switch(t){case"arrow_point"', 'E9e=o(t=>{let e="none",r="none";switch(t){case"arrow_point"'],
];
let applied = 0, skipped = 0;
for (const [from, to] of subs) {
  const count = s.split(from).length - 1;
  if (count === 0 && s.includes(to)) { skipped++; continue; }
  if (count !== 1) { console.error(`模式出现 ${count} 次（预期 1，且未命中已补丁形态）: ${from}`); process.exit(1); }
  s = s.replace(from, to);
  applied++;
}
// 确认 Op 是 curveLinear、Do 是 curveBasis
if (!/curveLinear:Op,/.test(s) || !/curveBasis:Do[,\}]/.test(s)) { console.error('Op/Do 标识符校验失败'); process.exit(1); }
fs.writeFileSync(path, s, 'utf-8');
console.log(`patched: 新打 ${applied} 处，已存在跳过 ${skipped} 处（插值 Do->Op 两处 + --- 无箭头一处）`);
