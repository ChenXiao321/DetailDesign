// normalizeModel（读取侧迁移）单测：v1→v2 Callout 从 calledExternalFunctions 拆入 calloutFunctions；
// v2→v3 dynamicDesign.stateMachine 单字段就地升为 stateMachines 数组
// 口径：就地迁移/形态驱动/幂等；拆分后 cef 保序、callouts 按原相对序（=name 序，与 analyze 落盘口径一致）
const assert = require('assert');
const { normalizeModel, lintModelSchema } = require('../packages/core/dist/index.js');
const { SCHEMA_VERSION } = require('../packages/core/dist/model/types.js');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log(`  ✓ ${name}`); };

const ext = (name, group, chapter) => ({
  name, signature: `void ${name}(void)`, group, comment: null, calledFrom: ['A'],
  polarion: { isWorkItem: true, chapter, workItemKind: chapter === '6.2' ? 'function' : 'table', title: name, workItemId: null },
});
// 最小合法模型（lint 无 opts 时只查 schemaVersion + TOP_KEYS）
const model = (over = {}) => ({
  module: 'M', schemaVersion: 1, analyzedAt: '2026-01-01', files: [],
  providedFunctions: [], internalFunctions: [], internalVariables: [], providedVariables: [],
  calledExternalFunctions: [], types: [], configMacros: [],
  interfaceOverview: { diagram: 'flowchart LR', diagramFormat: 'mermaid', polarion: { isWorkItem: false } },
  callGraphs: [],
  ...over,
});

// ================= 场景 1：v1 混排旧形态 → 正确拆分且保序 =================
{
  // 旧落盘口径 sort(group,name)：Callout 组内按 name 有序、与普通组混排
  const m = model({
    calledExternalFunctions: [
      ext('CalloutB', 'Callout', '6.2'),
      ext('CalloutA', 'Callout', '6.2'),
      ext('Spi_Send', 'Spi.h', '5.2.2.2'),
      ext('Spi_Recv', 'Spi.h', '5.2.2.2'),
      ext('RstM_Main', 'Gp_RstM.h', '5.2.2.2'),
    ].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
  });
  normalizeModel(m);
  ok(m.calledExternalFunctions.map(e => e.name).join(',') === 'Spi_Recv,Spi_Send,RstM_Main'
    || m.calledExternalFunctions.every(e => e.group !== 'Callout'),
    'S1 cef 只剩普通外部接口');
  ok(m.calledExternalFunctions.map(e => `${e.group}:${e.name}`).join(',')
      === 'Gp_RstM.h:RstM_Main,Spi.h:Spi_Recv,Spi.h:Spi_Send',
    'S1 cef 保持 sort(group,name) 相对序');
  ok(m.calloutFunctions.map(e => e.name).join(',') === 'CalloutA,CalloutB',
    'S1 Callout 按原相对序（=name 序）移入 calloutFunctions');
  ok(m.schemaVersion === SCHEMA_VERSION, 'S1 schemaVersion 升至当前版本');
}

// ================= 场景 1b：v2→v3 状态机单字段升数组 =================
{
  const sm = { name: 'SM', diagram: 'stateDiagram-v2\n    [*] --> A', diagramFormat: 'mermaid', states: [], transitions: [], polarion: {} };
  const m = model({ schemaVersion: 2, dynamicDesign: { stateMachine: sm, sequences: [] } });
  normalizeModel(m);
  ok(Array.isArray(m.dynamicDesign.stateMachines) && m.dynamicDesign.stateMachines[0] === sm
    && m.dynamicDesign.stateMachine === undefined, 'S1b stateMachine 就地升为 stateMachines 数组');
  const arr = m.dynamicDesign.stateMachines;
  normalizeModel(m);
  ok(m.dynamicDesign.stateMachines === arr && m.dynamicDesign.stateMachine === undefined,
    'S1b 二次 normalize 不动（幂等）');
  const m2 = model({ schemaVersion: 2, dynamicDesign: { stateMachine: null, sequences: [] } });
  normalizeModel(m2);
  ok(m2.dynamicDesign.stateMachines === undefined && m2.dynamicDesign.stateMachine === null,
    'S1b stateMachine=null（无状态机旧形态）不建数组');
}

// ================= 场景 2：幂等 =================
{
  const m = model({ calledExternalFunctions: [ext('CalloutX', 'Callout', '6.2'), ext('Spi_Send', 'Spi.h', '5.2.2.2')] });
  normalizeModel(m);
  const first = JSON.stringify(m);
  normalizeModel(m);
  ok(JSON.stringify(m) === first, 'S2 二次 normalize 结果不变（幂等）');
}

// ================= 场景 3：已是新形态 → 零变化 =================
{
  const m = model({
    schemaVersion: SCHEMA_VERSION,
    calledExternalFunctions: [ext('Spi_Send', 'Spi.h', '5.2.2.2')],
    calloutFunctions: [ext('CalloutX', 'Callout', '6.2')],
    generalConfigMacros: [], functionalConfigMacros: [], aliasConfigMacros: [],
  });
  delete m.configMacros;   // 场景 3 为「已是新形态」——剔除 base fixture 的旧键防误迁移
  const before = JSON.stringify(m);
  normalizeModel(m);
  ok(JSON.stringify(m) === before, 'S3 新形态零变化');
}

// ================= 场景 4：缺 calloutFunctions 键 → 补空数组 =================
{
  const m = model({ calledExternalFunctions: [ext('Spi_Send', 'Spi.h', '5.2.2.2')] });
  normalizeModel(m);
  ok(Array.isArray(m.calloutFunctions) && m.calloutFunctions.length === 0, 'S4 缺键补空数组');
}

// ================= 场景 5：schemaVersion 口径 =================
{
  const m1 = model({ schemaVersion: 1 }); normalizeModel(m1);
  ok(m1.schemaVersion === SCHEMA_VERSION, 'S5 版本 1→当前');
  const m0 = model({}); delete m0.schemaVersion; normalizeModel(m0);
  ok(m0.schemaVersion === SCHEMA_VERSION, 'S5 版本缺失→当前');
  const m2 = model({ schemaVersion: SCHEMA_VERSION }); normalizeModel(m2);
  ok(m2.schemaVersion === SCHEMA_VERSION, 'S5 当前版本不动');
}

// ================= 场景 6：跨数组重名去重 =================
{
  const dup = ext('CalloutX', 'Callout', '6.2');
  const m = model({
    calledExternalFunctions: [dup],
    calloutFunctions: [ext('CalloutX', 'Callout', '6.2')],
  });
  normalizeModel(m);
  ok(m.calloutFunctions.length === 1, 'S6 重名条目不双份');
  ok(m.calledExternalFunctions.length === 0, 'S6 cef 侧已移除');
}

// ================= 场景 7：旧形态直接喂 lintModelSchema → 自愈通过 =================
{
  const m = model({ calledExternalFunctions: [ext('CalloutX', 'Callout', '6.2')] });
  const problems = lintModelSchema(m);
  ok(problems.length === 0, `S7 旧形态 lint 全绿（实得 ${problems.length} 项${problems[0] ? `: ${problems[0]}` : ''}）`);
  ok(m.calloutFunctions.length === 1 && m.schemaVersion === SCHEMA_VERSION, 'S7 lint 入口已就地迁移');
}

console.log(`\n_test_normalize: ${n} 项断言全部通过 ✓`);
