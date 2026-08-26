// 把 _content/*.json 片段（Claude 执笔的设计内容）注入 lld_design.json（llmModel 记为 claude-sample）
// 用法: node _inject_content.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const designPath = path.join(dir, 'lld_design.json');
const model = JSON.parse(fs.readFileSync(designPath, 'utf-8'));
const now = new Date().toISOString();
const LLM = 'claude-sample';

const frags = ['funcs_a.json', 'funcs_b.json', 'funcs_c.json', 'funcs_d.json', 'funcs_x.json', 'misc_e.json']
  .map(f => path.join(dir, '_content', f))
  .filter(p => fs.existsSync(p))
  .map(p => JSON.parse(fs.readFileSync(p, 'utf-8')));

const FUNC = {}, CFG = {}, CO = {};
let functionalDescription;
for (const fr of frags) {
  Object.assign(FUNC, fr.functions ?? {});
  Object.assign(CFG, fr.configs ?? {});
  Object.assign(CO, fr.callouts ?? {});
  if (fr.functionalDescription) functionalDescription = fr.functionalDescription;
}

const missing = [];
let nFn = 0, nFc = 0;
for (const fn of [...model.providedFunctions, ...model.internalFunctions]) {
  const c = FUNC[fn.name];
  if (!c) { missing.push(fn.name); continue; }
  fn.generated = {
    detailedDescription: c.description,
    flowchart: c.flowchart,
    flowchartFormat: 'mermaid',
    llmModel: LLM,
    generatedAt: now,
  };
  if (c.description) nFn++;
  if (c.flowchart) nFc++;
}

let nCfg = 0;
for (const macro of model.configMacros) {
  if (macro.kind === 'alias') continue;
  const text = CFG[macro.name];
  if (!text) { missing.push('config:' + macro.name); continue; }
  macro.generated = { valueEffect: text, llmModel: LLM, generatedAt: now };
  nCfg++;
}

let nCo = 0;
for (const ext of model.calledExternalFunctions.filter(e => e.group === 'Callout')) {
  const text = CO[ext.name];
  if (!text) { missing.push('callout:' + ext.name); continue; }
  ext.generated = { detailedDescription: text, llmModel: LLM, generatedAt: now };
  nCo++;
}

if (functionalDescription) model.functionalDescription = functionalDescription;

const dynPath = path.join(dir, '_content', 'dynamic.json');
if (fs.existsSync(dynPath)) {
  model.dynamicDesign = JSON.parse(fs.readFileSync(dynPath, 'utf-8'));
}

fs.writeFileSync(designPath, JSON.stringify(model, null, 2), 'utf-8');
console.log(`函数描述 ${nFn}，流程图 ${nFc}，配置说明 ${nCfg}，Callout ${nCo}，functionalDescription ${functionalDescription ? '✓' : '—'}，dynamicDesign ${model.dynamicDesign ? '✓' : '—'}`);
if (missing.length) { console.error('缺失条目:\n  ' + missing.join('\n  ')); process.exit(1); }
