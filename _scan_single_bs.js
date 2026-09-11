// 扫描模板字面量内单反斜杠正则转义（\d \s \w \b 前面不是反斜杠 = 会被模板吞掉）
const fs = require('fs');
for (const f of ['packages/core/src/report/renderScript.ts', 'packages/core/src/report/mermaidPre.ts',
                 'packages/core/src/report/htmlReport.ts', 'packages/core/src/report/cards.ts']) {
  const lines = fs.readFileSync(f, 'utf-8').split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/(?<!\\)\\[dswbSDWB]/g);
    if (m) console.log(f + ':' + (i + 1), m.join(','), '|', l.trim().slice(0, 110));
  });
}
