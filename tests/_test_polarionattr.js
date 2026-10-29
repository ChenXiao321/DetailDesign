// Polarion 属性（wiType/verifyMethod）物化进 design json 测试（polarionAttributes 纯逻辑）
// 口径：与 sync.json §6.0 一致——函数 IF/LF、类型 TDST/TDE/TDB、变量 GV/LV、
// Callout/组表/配置宏/图/章节级 Design；verifyMethod：函数/外部接口/配置宏=test，其余=review
const assert = require('assert');
const { materializePolarionAttributes, applyModuleDiff, diffModules, normalizeModel } = require('../packages/core/dist/index.js');
const { SCHEMA_VERSION } = require('../packages/core/dist/model/types.js');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log(`  ✓ ${name}`); };

// ---- 夹具构造 ----
const marker = (chapter) => ({ isWorkItem: true, chapter, workItemKind: 'function', title: 't', workItemId: null });
const fn = (name) => ({
  id: `M::${name}`, name, signature: `void ${name}(void)`, returnType: 'void',
  parameters: [], isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 10,
  comment: null, calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
  bodyText: 'x', bodyHash: `b_${name}`, sigHash: `s_${name}`, polarion: marker('5.2.3.2'),
});
const vr = (name, isStatic) => ({
  id: `V::${name}`, name, type: 'uint8', isStatic, isConst: false, isVolatile: false,
  file: 'm.c', line: 1, comment: null, conditionalFlags: [], polarion: marker(isStatic ? '5.2.4.1' : '5.2.3.1'),
});
const typ = (name, kind, relatedDefines) => ({
  id: `T::${name}`, name, kind, file: 't.h', polarion: marker('5.2.1.2'),
  ...(relatedDefines ? { relatedDefines } : {}),
});
const ext = (name, chapter, group) => ({
  name, signature: `void ${name}(void)`, group: group ?? (chapter === '6.2' ? 'Callout' : 'Ext'), comment: null, calledFrom: ['A'],
  polarion: { isWorkItem: true, chapter, workItemKind: chapter === '6.2' ? 'function' : 'table', title: name, workItemId: null },
});
const cfg = (name) => ({
  name, value: '1', isFunctionLike: false, comment: null, file: 'c.h', kind: 'general',
  usages: [], affects: [], polarion: marker('6.1'),
});
const sm = (name) => ({
  name, diagram: 'stateDiagram-v2', diagramFormat: 'mermaid', states: [], transitions: [],
  polarion: { isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine', title: name, workItemId: null },
});
const seq = (name) => ({
  name, diagram: 'sequenceDiagram', diagramFormat: 'mermaid', description: 'd',
  polarion: { isWorkItem: true, chapter: '5.3.2', workItemKind: 'sequence', title: name, workItemId: null },
});
const model = (over = {}) => ({
  module: 'M', schemaVersion: SCHEMA_VERSION, analyzedAt: '2026-01-01', files: [],
  providedFunctions: [], internalFunctions: [], internalVariables: [], providedVariables: [],
  calledExternalFunctions: [], calloutFunctions: [], types: [], configMacros: [],
  ...over,
});

// ================= 场景 1：五类工作项节点映射全组合 =================
{
  const m = model({
    providedFunctions: [fn('PubFn')],
    internalFunctions: [fn('IntlFn')],
    providedVariables: [vr('PubVar', false)],
    internalVariables: [vr('IntlVar', true)],
    types: [
      typ('StType', 'struct'),
      typ('EnType', 'typedef', [{ name: 'E_A', value: '0', comment: null }]),
      typ('BaseType', 'typedef'),
    ],
    calledExternalFunctions: [ext('GrpFn', '5.2.2.2')],
    calloutFunctions: [ext('CalloutX', '6.2')],
    generalConfigMacros: [cfg('CFG_A')],
  });
  materializePolarionAttributes(m);
  const pw = (list, name) => list.find(x => x.name === name).polarion;
  ok(pw(m.providedFunctions, 'PubFn').wiType === 'IF' && pw(m.providedFunctions, 'PubFn').verifyMethod === 'test',
    'S1 对外函数=IF/test');
  ok(pw(m.internalFunctions, 'IntlFn').wiType === 'LF' && pw(m.internalFunctions, 'IntlFn').verifyMethod === 'test',
    'S1 内部函数=LF/test');
  ok(pw(m.providedVariables, 'PubVar').wiType === 'GV' && pw(m.providedVariables, 'PubVar').verifyMethod === 'review',
    'S1 对外变量=GV/review');
  ok(pw(m.internalVariables, 'IntlVar').wiType === 'LV' && pw(m.internalVariables, 'IntlVar').verifyMethod === 'review',
    'S1 内部变量=LV/review');
  ok(pw(m.types, 'StType').wiType === 'TDST', 'S1 struct=TDST');
  ok(pw(m.types, 'EnType').wiType === 'TDE', 'S1 枚举式 typedef=TDE');
  ok(pw(m.types, 'BaseType').wiType === 'TDB', 'S1 普通 typedef=TDB');
  ok(m.types.every(t => t.polarion.verifyMethod === 'review'), 'S1 类型一律 review');
  ok(pw(m.calloutFunctions, 'CalloutX').wiType === 'Design' && pw(m.calloutFunctions, 'CalloutX').verifyMethod === 'test',
    'S1 Callout=Design/test');
  ok(pw(m.calledExternalFunctions, 'GrpFn').wiType === 'Design' && pw(m.calledExternalFunctions, 'GrpFn').verifyMethod === 'test',
    'S1 组表接口=Design/test');
  ok(pw(m.generalConfigMacros, 'CFG_A').wiType === 'Design' && pw(m.generalConfigMacros, 'CFG_A').verifyMethod === 'test',
    'S1 配置宏=Design/test');
}

// ================= 场景 2：图节点 + 章节级工作项 =================
{
  const m = model({
    dynamicDesign: {
      stateMachines: [sm('主核 SM'), sm('从核 SM')],
      sequences: [seq('Initialization'), seq('Shutdown')],
    },
    interfaceOverview: { diagram: 'flowchart LR', diagramFormat: 'mermaid', polarion: marker('5.1') },
    callGraphs: [{ name: 'A', diagram: 'flowchart LR', diagramFormat: 'mermaid', polarion: marker('5.1') }],
  });
  materializePolarionAttributes(m);
  ok(m.dynamicDesign.stateMachines.every(s => s.polarion.wiType === 'Design' && s.polarion.verifyMethod === 'review'),
    'S2 多核状态机全角色图=Design/review');
  ok(m.dynamicDesign.sequences.every(s => s.polarion.wiType === 'Design' && s.polarion.verifyMethod === 'review'),
    'S2 序列图=Design/review');
  ok(m.interfaceOverview.polarion.wiType === 'Design' && m.interfaceOverview.polarion.verifyMethod === 'review',
    'S2 功能接口总图=Design/review');
  ok(m.callGraphs[0].polarion.wiType === 'Design' && m.callGraphs[0].polarion.verifyMethod === 'review',
    'S2 内部函数调用图=Design/review');
  const ci = m.polarionChapterItems;
  ok(Array.isArray(ci) && ci.length === 5, 'S2 章节级工作项恰 5 条');
  const chapters = ci.map(i => i.chapter).sort();
  ok(JSON.stringify(chapters) === JSON.stringify(['3.1', '3.2', '4.1', '5.1', '7']),
    'S2 章节级覆盖 5.1/4.1/7/3.1/3.2');
  ok(ci.every(i => i.wiType === 'Design' && i.verifyMethod === 'review'),
    'S2 章节级一律 Design/review');
}

// ================= 场景 3：存量旧形态（仅有 stateMachine 单字段）normalizeModel 迁移后物化 =================
{
  const m = model({ dynamicDesign: { stateMachine: sm('SM'), sequences: [] } });
  normalizeModel(m);   // 读取侧迁移：stateMachine → stateMachines 数组（同 CLI 各入口先例）
  materializePolarionAttributes(m);
  ok(Array.isArray(m.dynamicDesign.stateMachines) && m.dynamicDesign.stateMachines[0].name === 'SM',
    'S3 旧单图形态迁移为数组');
  ok(m.dynamicDesign.stateMachines[0].polarion.wiType === 'Design'
    && m.dynamicDesign.stateMachines[0].polarion.verifyMethod === 'review',
    'S3 迁移后物化兜底填充');
}

// ================= 场景 4：幂等 + 章节挪动/形态变化重跑刷新 =================
{
  const m = model({ providedFunctions: [fn('Mover')], types: [typ('Changer', 'typedef')] });
  materializePolarionAttributes(m);
  const first = JSON.stringify(m);
  materializePolarionAttributes(m);
  ok(JSON.stringify(m) === first, 'S4 连跑两次结果一致（幂等）');
  // 函数从对外挪到内部：重跑后 IF→LF
  m.internalFunctions = m.providedFunctions.splice(0, 1);
  // 普通 typedef 加上关联宏变枚举式：TDB→TDE
  m.types[0].relatedDefines = [{ name: 'E_B', value: '1', comment: null }];
  materializePolarionAttributes(m);
  ok(m.internalFunctions[0].polarion.wiType === 'LF', 'S4 函数挪内部后刷新为 LF');
  ok(m.types[0].polarion.wiType === 'TDE', 'S4 typedef 加关联宏后刷新为 TDE');
}

// ================= 场景 5：update 合并回挂旧 dynamicDesign 后再物化补齐 =================
{
  // 旧 design json 为物化前存量：dynamicDesign marker 无 wiType/verifyMethod
  const oldDesign = model({
    providedFunctions: [{ ...fn('A'), generated: { detailedDescription: 'd', llmModel: 'mock', generatedAt: '2026-01-01' } }],
    dynamicDesign: { stateMachine: sm('SM'), sequences: [seq('SQ')] },
    functionalDescription: '旧描述',
  });
  normalizeModel(oldDesign);   // 读取侧迁移（CLI diff/update 入口先例）：旧单字段形态升为数组
  const newModel = model({ providedFunctions: [fn('A')] });
  // newModel 经 analyze 已物化（模拟 analyze 调用点）
  materializePolarionAttributes(newModel);
  const d = diffModules(oldDesign, newModel);
  const merged = applyModuleDiff(newModel, oldDesign, d);
  ok(merged.dynamicDesign.stateMachines[0].polarion.wiType === undefined,
    'S5 合并回挂旧 dynamicDesign 时存量 marker 确实缺字段');
  // cmdDiff 落盘前的物化调用点
  materializePolarionAttributes(merged);
  ok(merged.dynamicDesign.stateMachines[0].polarion.wiType === 'Design'
    && merged.dynamicDesign.stateMachines[0].polarion.verifyMethod === 'review'
    && merged.dynamicDesign.sequences[0].polarion.wiType === 'Design',
    'S5 落盘前再物化：旧 SM/序列图 marker 字段补齐');
  ok(merged.providedFunctions[0].polarion.wiType === 'IF', 'S5 新模型自带字段不受合并影响');
  ok(Array.isArray(merged.polarionChapterItems) && merged.polarionChapterItems.length === 5,
    'S5 合并产物章节级工作项在场');
}

console.log(`\n_test_polarionattr: ${n} 项断言全部通过 ✓`);
