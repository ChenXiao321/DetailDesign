// 结构完整性 lint 测试：①成品 json 全绿 ②缺 schemaVersion/顶层键/document/notes/configDetails 字段逐项报
// ③requireDocument=false 时存量 json（无 document 节）不硬拦 ④requirePngs 开关 ⑤无状态机模块不强求 SM PNG
const { lintModelSchema } = require('./packages/core/dist/model/schemaLint.js');
const { SCHEMA_VERSION } = require('./packages/core/dist/model/types.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

const DOC = {
  purpose: 'p', scope: 's', fileTable: [], importedTypes: [], complexityTable: [],
  configDetails: { M_CFG: { usageItems: [], example: 'e', tableRow: ['1', '值宏', ''], valueEffect: 'v' } },
  aliasNote: '', abbreviations: [], abbreviationNote: '', definitions: [], definitionNote: null,
  abbreviationGaps: [], evaluationRows: [], complexityNote: '', evaluationSummary: [],
  supportFiles: [], supportNote: '',
  notes: { overview: '', callGraph: '', include: '', providedVarsEmpty: '', externalVars: '',
    externalFnsCallout: '', internalVars: '', configGeneral: '', configFunctional: '', calloutCfg: '',
    evalSummaryIntro: '' },
  includeGraphPng: 'png',
};
function mkModel() {
  return {
    module: 'M', schemaVersion: SCHEMA_VERSION, analyzedAt: '',
    files: [], providedFunctions: [], internalFunctions: [], internalVariables: [],
    providedVariables: [], calledExternalFunctions: [], types: [],
    configMacros: [{ name: 'M_CFG' }],
    dynamicDesign: { stateMachine: { name: 'SM', diagramPng: 'png' }, sequences: [{ name: 'S', diagramPng: 'png' }] },
    functionalDescription: 'd',
    interfaceOverview: { diagramPng: 'png' },
    callGraphs: [{ name: 'G', diagramPng: 'png' }],
    document: JSON.parse(JSON.stringify(DOC)),
  };
}
const FULL = { requirePngs: true, requireDocument: true, requireDynamic: true };

// ① 成品全绿
check('成品 json 全绿', lintModelSchema(mkModel(), FULL).length === 0);

// ② 逐项缺陷检出
const m1 = mkModel(); delete m1.schemaVersion;
check('缺 schemaVersion 报', lintModelSchema(m1, FULL).some(p => p.includes('schemaVersion')));
const m2 = mkModel(); delete m2.files;
check('缺顶层键 files 报', lintModelSchema(m2, FULL).some(p => p === '顶层缺键 files'));
const m3 = mkModel(); delete m3.document;
check('缺 document 节报', lintModelSchema(m3, FULL).some(p => p.includes('document')));
const m4 = mkModel(); delete m4.document.fileTable;
check('document 缺 fileTable 报', lintModelSchema(m4, FULL).some(p => p === 'document 缺键 fileTable'));
const m5 = mkModel(); delete m5.document.notes.include;
check('notes 缺 include 报', lintModelSchema(m5, FULL).some(p => p === 'document.notes 缺键 include'));
const m6 = mkModel(); delete m6.document.configDetails.M_CFG.valueEffect;
check('configDetails 缺 valueEffect 报', lintModelSchema(m6, FULL).some(p => p === 'configDetails.M_CFG 缺字段 valueEffect'));
const m7 = mkModel(); delete m7.document.configDetails.M_CFG;
check('configDetails 缺宏报', lintModelSchema(m7, FULL).some(p => p === 'configDetails 缺宏 M_CFG'));
const m8 = mkModel(); delete m8.dynamicDesign;
check('requireDynamic 缺 dynamicDesign 报', lintModelSchema(m8, FULL).some(p => p.includes('dynamicDesign')));

// ③ 存量 json（无 document/dynamicDesign）放宽口径不硬拦
const legacy = mkModel(); delete legacy.document; delete legacy.dynamicDesign; delete legacy.functionalDescription;
check('存量 json 放宽口径仅核心键', lintModelSchema(legacy).length === 0,
  JSON.stringify(lintModelSchema(legacy)));

// ④ PNG 开关：缺 PNG 仅 requirePngs 时报
const m9 = mkModel(); delete m9.document.includeGraphPng;
check('缺 PNG 不开 requirePngs 不报', !lintModelSchema(m9, { requireDocument: true }).some(p => p.includes('PNG')));
check('缺 PNG 开 requirePngs 报', lintModelSchema(m9, FULL).some(p => p === 'PNG 缺失: document.includeGraphPng'));
const m10 = mkModel(); m10.providedFunctions.push({ name: 'F', generated: {} });
check('函数缺 flowchartPng 报', lintModelSchema(m10, FULL).some(p => p === 'PNG 缺失: F.flowchartPng'));

// ⑤ 无状态机模块不强求 SM PNG
const m11 = mkModel(); m11.dynamicDesign.stateMachine = null;
check('无状态机不强求 SM PNG', !lintModelSchema(m11, FULL).some(p => p.includes('stateMachine')));
const m12 = mkModel(); delete m12.dynamicDesign.stateMachine.diagramPng;
check('有状态机缺 PNG 报', lintModelSchema(m12, FULL).some(p => p === 'PNG 缺失: stateMachine.diagramPng'));

// ⑥ 多核分图：stateMachines[] 逐张查 + applyDiagramPng 同步兼容别名 stateMachine 的 PNG
const { applyDiagramPng } = require('./packages/core/dist/report/imageBatch.js');
const m13 = mkModel();
m13.dynamicDesign.stateMachines = [
  { name: 'SM主', diagramPng: undefined },
  { name: 'SM从', diagramPng: 'png' },
];
m13.dynamicDesign.stateMachine = { name: 'SM主' };   // json 反序列化后的独立别名对象
const before = lintModelSchema(m13, FULL);
check('多核别名缺 PNG 报', before.some(p => p === 'PNG 缺失: stateMachine.diagramPng')
  && before.some(p => p === 'PNG 缺失: sm[SM主].diagramPng'), JSON.stringify(before));
applyDiagramPng(m13, 'sm:SM主', 'png');
check('apply 后别名同步', m13.dynamicDesign.stateMachine.diagramPng === 'png'
  && lintModelSchema(m13, FULL).length === 0, JSON.stringify(lintModelSchema(m13, FULL)));

// ⑦ 存量自愈 syncSmAliasPng：旧产物别名缺 PNG 时从 stateMachines[0] 同步，无需重渲染
const { syncSmAliasPng } = require('./packages/core/dist/report/imageBatch.js');
const m14 = mkModel();
m14.dynamicDesign.stateMachines = [{ name: 'SM主', diagramPng: 'png' }, { name: 'SM从', diagramPng: 'png' }];
m14.dynamicDesign.stateMachine = { name: 'SM主' };
check('自愈前别名缺 PNG 报', lintModelSchema(m14, FULL).some(p => p === 'PNG 缺失: stateMachine.diagramPng'));
check('自愈同步别名', syncSmAliasPng(m14) === true && m14.dynamicDesign.stateMachine.diagramPng === 'png'
  && lintModelSchema(m14, FULL).length === 0);
check('自愈幂等', syncSmAliasPng(m14) === false);
const m15 = mkModel();
check('单图模块无需自愈', syncSmAliasPng(m15) === false);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
