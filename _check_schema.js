// json 结构完整性门禁（0930 结构冻结）：基线 json 必须全字段齐备——
// 堵 0929 盲区（gen --only document 整节替换冲掉 includeGraphPng，双字节门禁验 report 不验 json 字段，静默逃逸）
const fs = require('fs');

const BASELINE = '测试产出/Gp_EcuStpStdn/lld_design.json';
const j = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

const TOP_KEYS = ['module', 'schemaVersion', 'analyzedAt', 'files', 'providedFunctions',
  'internalFunctions', 'internalVariables', 'providedVariables', 'calledExternalFunctions',
  'types', 'configMacros', 'dynamicDesign', 'functionalDescription', 'interfaceOverview',
  'callGraphs', 'document'];
const DOC_KEYS = ['purpose', 'scope', 'fileTable', 'importedTypes', 'complexityTable',
  'configDetails', 'aliasNote', 'abbreviations', 'abbreviationNote', 'definitions',
  'definitionNote', 'abbreviationGaps', 'evaluationRows', 'complexityNote',
  'evaluationSummary', 'supportFiles', 'supportNote', 'notes', 'includeGraphPng'];
const NOTES_KEYS = ['overview', 'callGraph', 'include', 'providedVarsEmpty', 'externalVars',
  'externalFnsCallout', 'internalVars', 'configGeneral', 'configFunctional', 'calloutCfg',
  'evalSummaryIntro'];
const CONFIG_DETAIL_FIELDS = ['usageItems', 'example', 'tableRow', 'valueEffect'];

let bad = 0;
const fail = (msg) => { console.log(`✗ ${msg}`); bad++; };

if (j.schemaVersion !== 1) fail(`schemaVersion 应为 1，实得 ${j.schemaVersion}`);
for (const k of TOP_KEYS) if (!(k in j)) fail(`顶层缺键 ${k}`);
for (const k of DOC_KEYS) if (!(k in (j.document ?? {}))) fail(`document 缺键 ${k}`);
for (const k of NOTES_KEYS) if (!(k in (j.document?.notes ?? {}))) fail(`document.notes 缺键 ${k}`);
for (const c of j.configMacros ?? []) {
  const d = j.document?.configDetails?.[c.name];
  if (!d) { fail(`configDetails 缺宏 ${c.name}`); continue; }
  for (const f of CONFIG_DETAIL_FIELDS) if (!(f in d)) fail(`configDetails.${c.name} 缺字段 ${f}`);
}
// 全部六类图 PNG 存在性
const pngChecks = [
  ['interfaceOverview.diagramPng', j.interfaceOverview?.diagramPng],
  ...(j.callGraphs ?? []).map(g => [`callGraphs[${g.name}].diagramPng`, g.diagramPng]),
  ...[...(j.providedFunctions ?? []), ...(j.internalFunctions ?? [])]
    .map(f => [`${f.name}.flowchartPng`, f.generated?.flowchartPng]),
  ['stateMachine.diagramPng', j.dynamicDesign?.stateMachine?.diagramPng],
  ...(j.dynamicDesign?.sequences ?? []).map(s => [`seq[${s.name}].diagramPng`, s.diagramPng]),
  ['document.includeGraphPng', j.document?.includeGraphPng],
];
for (const [label, v] of pngChecks) {
  if (typeof v !== 'string' || v.length === 0) fail(`PNG 缺失: ${label}`);
}
console.log(`PNG 检查 ${pngChecks.length} 张`);
console.log(bad === 0 ? `✓ 结构完整性全绿（${BASELINE}）` : `共 ${bad} 项缺失`);
process.exit(bad ? 1 : 0);
