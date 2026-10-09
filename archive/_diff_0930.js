// 递归 diff 两个 design json：结构性差异（键增删/值变化），长字符串只报长度与前 60 字
const fs = require('fs');
const A = JSON.parse(fs.readFileSync('导入polarion/lld_design_before.json', 'utf8')); // 旧
const B = JSON.parse(fs.readFileSync('导入polarion/lld_design.json', 'utf8'));        // 新

const MAX = 2000;
let diffs = 0;
function short(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 60) + `…(len=${s.length})` : s;
}
function diff(a, b, path) {
  if (diffs > MAX) return;
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    // 长文本只报差异摘要
    if (typeof a === 'string' && typeof b === 'string' && (a.length > 120 || b.length > 120)) {
      let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
      console.log(`~ ${path}\n   旧 len=${a.length} 新 len=${b.length} 首个分歧@${i}\n   旧: …${a.slice(Math.max(0, i - 25), i + 45)}\n   新: …${b.slice(Math.max(0, i - 25), i + 45)}`);
    } else {
      console.log(`~ ${path}\n   旧: ${short(a)}\n   新: ${short(b)}`);
    }
    diffs++; return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { console.log(`~ ${path} 数组/非数组类型变化`); diffs++; return; }
    if (a.length !== b.length) { console.log(`~ ${path} 数组长度 旧=${a.length} 新=${b.length}`); diffs++; }
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`);
    return;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  for (const k of ka) if (!(k in b)) { console.log(`- ${path}.${k}（新文件缺失）旧值: ${short(a[k])}`); diffs++; }
  for (const k of kb) if (!(k in a)) { console.log(`+ ${path}.${k}（新增）值: ${short(b[k])}`); diffs++; }
  for (const k of ka) if (k in b) diff(a[k], b[k], `${path}.${k}`);
}
diff(A, B, 'root');
console.log(`\n共 ${diffs}${diffs > MAX ? '+' : ''} 处差异`);
