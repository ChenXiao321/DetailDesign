// 把 htmlReport.ts 内嵌的 ORTHO 后处理脚本原样同步进 _mkverify.js 的 const ORTHO
const fs = require('fs');
const ts = fs.readFileSync('packages/core/src/report/htmlReport.ts', 'utf-8');
const startMark = 'const median = (vals)';
const si = ts.indexOf(startMark);
if (si < 0) throw new Error('start mark not found');
// forEach 结束 "  });" 之后紧跟 addEventListener 结束 "});"（主循环末尾是标签重挂的 if 块）
const endMark = "    }\n  });\n});";
const ei = ts.indexOf(endMark, si);
if (ei < 0) throw new Error('end mark not found');
const body = ts.slice(si, ei + "    }\n  });".length)
  .replace(/\\\\/g, '\\');  // 模板字符串里的 \\d 是转义写法，拷到独立页面时用原形 \d
const mk = '测试产出/Gp_EcuStpStdn/_mkverify.js';
let src = fs.readFileSync(mk, 'utf-8');
if (!/^const ORTHO = .*;$/m.test(src)) throw new Error('ORTHO line not found');
src = src.replace(/^const ORTHO = .*;$/m, 'const ORTHO = ' + JSON.stringify(body) + ';');
fs.writeFileSync(mk, src, 'utf-8');
console.log('synced, ORTHO length =', body.length);
