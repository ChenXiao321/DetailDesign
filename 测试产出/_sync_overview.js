// 把 analyze 新产出的 interfaceOverview 同步进 lld_design.json（report 优先读 design）
const fs = require('fs');
const dir = process.argv[2];
const model = JSON.parse(fs.readFileSync(dir + '/lld_model.json', 'utf-8'));
const design = JSON.parse(fs.readFileSync(dir + '/lld_design.json', 'utf-8'));
design.interfaceOverview = model.interfaceOverview;
fs.writeFileSync(dir + '/lld_design.json', JSON.stringify(design, null, 2), 'utf-8');
console.log('synced interfaceOverview into', dir + '/lld_design.json');
