// 结构完整性 lint 测试：①成品 json 全绿 ②缺 schemaVersion/顶层键/document/notes/configDetails* 字段逐项报
// ③requireDocument=false 时存量 json（无 document 节）不硬拦 ④requirePngs 开关 ⑤无状态机模块不强求 SM PNG
// ⑥存量旧形态（仅有 stateMachine 单字段）经 lint 入口 normalizeModel 自动迁移为 stateMachines 数组
const { lintModelSchema } = require('../packages/core/dist/model/schemaLint.js');
const { SCHEMA_VERSION } = require('../packages/core/dist/model/types.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

const DOC = {
  purpose: 'p', scope: 's', fileTable: [], importedTypes: [], complexityTable: [],
  configDetailsGeneral: { M_CFG: { usageItems: [], example: 'e', tableRow: ['1', '值宏', ''], valueEffect: 'v' } },
  configDetailsFunctional: {},
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
    providedVariables: [], calledExternalFunctions: [], calloutFunctions: [], types: [],
    generalConfigMacros: [{ name: 'M_CFG', kind: 'general', usages: [], affects: [] }],
    functionalConfigMacros: [], aliasConfigMacros: [],
    dynamicDesign: { stateMachines: [{ name: 'SM', diagramPng: 'png' }], sequences: [{ name: 'S', diagramPng: 'png' }] },
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
// 缺 schemaVersion：lint 入口 normalizeModel 自愈（补当前版本号），不再硬报——自愈系设计（同 syncSmAliasPng 先例）
const m1 = mkModel(); delete m1.schemaVersion;
check('缺 schemaVersion 经 normalize 自愈不报', lintModelSchema(m1, FULL).length === 0
  && m1.schemaVersion === SCHEMA_VERSION, JSON.stringify(lintModelSchema(m1, FULL)));
const m2 = mkModel(); delete m2.files;
check('缺顶层键 files 报', lintModelSchema(m2, FULL).some(p => p === '顶层缺键 files'));
const m3 = mkModel(); delete m3.document;
check('缺 document 节报', lintModelSchema(m3, FULL).some(p => p.includes('document')));
const m4 = mkModel(); delete m4.document.fileTable;
check('document 缺 fileTable 报', lintModelSchema(m4, FULL).some(p => p === 'document 缺键 fileTable'));
const m5 = mkModel(); delete m5.document.notes.include;
check('notes 缺 include 报', lintModelSchema(m5, FULL).some(p => p === 'document.notes 缺键 include'));
const m6 = mkModel(); delete m6.document.configDetailsGeneral.M_CFG.valueEffect;
check('configDetailsGeneral 缺 valueEffect 报', lintModelSchema(m6, FULL).some(p => p === 'configDetailsGeneral.M_CFG 缺字段 valueEffect'));
const m7 = mkModel(); delete m7.document.configDetailsGeneral.M_CFG;
check('configDetailsGeneral 缺宏报', lintModelSchema(m7, FULL).some(p => p === 'configDetailsGeneral 缺宏 M_CFG'));
const m7b = mkModel();
m7b.functionalConfigMacros.push({ name: 'F_CFG', kind: 'functional', usages: [], affects: [] });
check('functional 宏进 configDetailsFunctional 查（缺则报）',
  lintModelSchema(m7b, FULL).some(p => p === 'configDetailsFunctional 缺宏 F_CFG')
    && !lintModelSchema(m7b, FULL).some(p => p.includes('configDetailsGeneral 缺宏 F_CFG')));
const m7c = mkModel();
m7c.aliasConfigMacros.push({ name: 'A_CFG', kind: 'alias', usages: [], affects: [] });
check('别名宏不要求进明细（不上报告章节）', lintModelSchema(m7c, FULL).length === 0, JSON.stringify(lintModelSchema(m7c, FULL)));
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
const m11 = mkModel(); m11.dynamicDesign.stateMachines = [];
check('无状态机不强求 SM PNG', !lintModelSchema(m11, FULL).some(p => p.includes('sm[')));
const m12 = mkModel(); delete m12.dynamicDesign.stateMachines[0].diagramPng;
check('有状态机缺 PNG 报', lintModelSchema(m12, FULL).some(p => p === 'PNG 缺失: sm[SM].diagramPng'));

// ⑥ 多核分图：stateMachines[] 逐张查 + applyDiagramPng 按名写回
const { applyDiagramPng } = require('../packages/core/dist/report/imageBatch.js');
const m13 = mkModel();
m13.dynamicDesign.stateMachines = [
  { name: 'SM主', diagramPng: undefined },
  { name: 'SM从', diagramPng: 'png' },
];
const before = lintModelSchema(m13, FULL);
check('多核缺 PNG 逐张报', before.some(p => p === 'PNG 缺失: sm[SM主].diagramPng'), JSON.stringify(before));
applyDiagramPng(m13, 'sm:SM主', 'png');
check('apply 后按名写回', m13.dynamicDesign.stateMachines[0].diagramPng === 'png'
  && lintModelSchema(m13, FULL).length === 0, JSON.stringify(lintModelSchema(m13, FULL)));

// ⑦ 存量旧形态迁移：仅有 stateMachine 单字段（无数组）→ lint 入口 normalizeModel 就地升为数组
const m14 = mkModel();
delete m14.dynamicDesign.stateMachines;
m14.dynamicDesign.stateMachine = { name: 'SM旧', diagramPng: 'png' };
check('旧单图形态迁移为数组且零缺陷', lintModelSchema(m14, FULL).length === 0
  && Array.isArray(m14.dynamicDesign.stateMachines) && m14.dynamicDesign.stateMachines[0].name === 'SM旧'
  && m14.dynamicDesign.stateMachine === undefined, JSON.stringify(lintModelSchema(m14, FULL)));
check('迁移幂等', lintModelSchema(m14, FULL).length === 0);

// ⑧ 工作项 title 唯一性（Polarion 映射键=(章节,title)）
const wi = (chapter, title, kind) => ({ isWorkItem: true, chapter, title, workItemKind: kind, workItemId: null });
const m16 = mkModel();
m16.internalFunctions.push(
  { name: 'Init', file: 'a.c', polarion: wi('5.2.4.2', 'Init', 'function') },
  { name: 'Init', file: 'b.c', polarion: wi('5.2.4.2', 'Init', 'function') },
);
check('同章节工作项 title 重名报（同名 static 函数）',
  lintModelSchema(m16).some(p => p.includes('工作项 title 重名') && p.includes('Init') && p.includes('a.c') && p.includes('b.c')),
  JSON.stringify(lintModelSchema(m16)));
const m17 = mkModel();
m17.calledExternalFunctions.push(
  { name: 'Spi_A', polarion: wi('5.2.2.2', 'Spi 接口函数', 'table') },
  { name: 'Spi_B', polarion: wi('5.2.2.2', 'Spi 接口函数', 'table') },
);
check('组表工作项同 title 共享不报（设计本意）', lintModelSchema(m17).length === 0, JSON.stringify(lintModelSchema(m17)));
const m18 = mkModel();
m18.providedFunctions.push({ name: 'X', file: 'a.c', polarion: wi('5.2.3.2', 'X', 'function') });
m18.calloutFunctions.push({ name: 'X', group: 'Callout', polarion: wi('6.2', 'X', 'function') });
check('跨章节同 title 不报（映射键含章节号）', lintModelSchema(m18).length === 0, JSON.stringify(lintModelSchema(m18)));
const m19 = mkModel();
m19.callGraphs.push({ name: 'G2', diagramPng: 'png', polarion: wi('5.1', 'A 调用图', 'diagram') });
m19.callGraphs.push({ name: 'G3', diagramPng: 'png', polarion: wi('5.1', 'A 调用图', 'diagram') });
check('调用图工作项 title 重名报', lintModelSchema(m19, FULL).some(p => p.includes('工作项 title 重名') && p.includes('A 调用图')));

// ⑨ v1 旧形态自愈：Callout 混在 calledExternalFunctions、无 calloutFunctions 键、schemaVersion=1
// → lint 入口 normalize 后就地迁移通过（_check_schema.js 对存量产物零改动全绿靠此）
const m20 = mkModel();
m20.schemaVersion = 1;
delete m20.calloutFunctions;
m20.calledExternalFunctions.push({ name: 'CalloutX', group: 'Callout', polarion: wi('6.2', 'CalloutX', 'function') });
check('v1 旧形态 lint 自愈通过', lintModelSchema(m20).length === 0, JSON.stringify(lintModelSchema(m20)));
check('v1 旧形态 lint 后就地迁移', m20.calloutFunctions.length === 1
  && m20.calledExternalFunctions.length === 0 && m20.schemaVersion === SCHEMA_VERSION);

// ⑩ v1 旧形态 title 唯一性仍跨数组检出：Callout 迁移后与 6.2 既有项撞名要报
const m21 = mkModel();
m21.schemaVersion = 1;
delete m21.calloutFunctions;
m21.calledExternalFunctions.push({ name: 'C1', group: 'Callout', polarion: wi('6.2', 'Same', 'function') });
// 迁移后 cef 空了，再补一个 6.2 同名项到 calloutFunctions 落点（模拟两侧撞名）
m21.calledExternalFunctions.push({ name: 'C2', group: 'Callout', polarion: wi('6.2', 'Same', 'function') });
check('迁移后 6.2 title 撞名报', lintModelSchema(m21).some(p => p.includes('工作项 title 重名') && p.includes('Same')),
  JSON.stringify(lintModelSchema(m21)));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
