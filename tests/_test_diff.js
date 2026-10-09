// 版本更新差异比对 + 失效合并测试（modelDiff 纯逻辑）
const assert = require('assert');
const { diffModules, applyModuleDiff } = require('../packages/core/dist/index.js');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log(`  ✓ ${name}`); };

// ---- 夹具构造 ----
let uid = 0;
const fn = (name, sigHash, bodyHash, generated) => ({
  id: `M::${name}`, name, signature: `void ${name}(void)`, returnType: 'void',
  parameters: [], isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 10,
  comment: null, calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
  bodyText: 'x', bodyHash, sigHash, polarion: { workItemId: null },
  ...(generated ? { generated: { detailedDescription: `desc-${name}`, flowchart: 'flowchart TD', llmModel: 'mock', generatedAt: '2026-01-01' } } : {}),
});
const typ = (name, underlyingType, generated) => ({
  id: `T::${name}`, name, kind: 'typedef', underlyingType, file: 't.h',
  polarion: { workItemId: null },
  ...(generated ? { generated: { comment: `tc-${name}`, llmModel: 'mock', generatedAt: '2026-01-01' } } : {}),
});
const ext = (name, signature, generated) => ({
  name, signature, group: 'Ext', comment: null, calledFrom: ['A'],
  polarion: { workItemId: null },
  ...(generated ? { generated: { detailedDescription: `ed-${name}`, llmModel: 'mock', generatedAt: '2026-01-01' } } : {}),
});
const cfg = (name, value, generated) => ({
  name, value, isFunctionLike: false, comment: null, file: 'c.h', kind: 'general',
  usages: [], affects: [], polarion: { workItemId: null },
  ...(generated ? { generated: { valueEffect: `ve-${name}`, llmModel: 'mock', generatedAt: '2026-01-01' } } : {}),
});
const model = (over = {}) => ({
  module: 'M', schemaVersion: 1, analyzedAt: over.analyzedAt ?? `2026-01-0${++uid}`,
  files: [],
  providedFunctions: [], internalFunctions: [], internalVariables: [], providedVariables: [],
  calledExternalFunctions: [], types: [], configMacros: [],
  ...over,
});

// ================= 场景 1：完全无变更 =================
{
  const old = model({
    providedFunctions: [fn('A', 's1', 'b1', true), fn('B', 's2', 'b2', true)],
    types: [typ('T1', 'uint8', true)],
    calledExternalFunctions: [ext('E1', 'void E1(void)', true)],
    configMacros: [cfg('C1', '1', true)],
    functionalDescription: '旧5.1描述',
    dynamicDesign: { stateMachine: { name: 'SM' }, sequences: [{ name: 'SQ' }] },
    document: { purpose: 'p' },
    interfaceOverview: { diagram: 'flowchart TD\nX', diagramFormat: 'mermaid', polarion: {}, diagramPng: 'PNG_IO' },
    callGraphs: [{ name: 'A', diagram: 'flowchart TD\nY', diagramFormat: 'mermaid', polarion: {}, diagramPng: 'PNG_CG' }],
  });
  const nw = model({
    providedFunctions: [fn('A', 's1', 'b1'), fn('B', 's2', 'b2')],
    types: [typ('T1', 'uint8')],
    calledExternalFunctions: [ext('E1', 'void E1(void)')],
    configMacros: [cfg('C1', '1')],
    interfaceOverview: { diagram: 'flowchart TD\nX', diagramFormat: 'mermaid', polarion: {} },
    callGraphs: [{ name: 'A', diagram: 'flowchart TD\nY', diagramFormat: 'mermaid', polarion: {} }],
  });
  const d = diffModules(old, nw);
  ok(!d.hasChanges && !d.dynamicInvalidated && !d.descriptionInvalidated, 'S1 无变更：三个标志全 false');
  ok(d.functions.unchanged.length === 2 && d.functions.changed.length === 0, 'S1 两函数均未变');

  const m = applyModuleDiff(nw, old, d);
  ok(m.providedFunctions.every(f => f.generated), 'S1 合并后 generated 全保留');
  ok(m.functionalDescription === '旧5.1描述', 'S1 5.1 描述保留');
  ok(m.dynamicDesign?.stateMachine?.name === 'SM' && m.dynamicDesign.sequences.length === 1, 'S1 动态设计整节保留');
  ok(m.document === undefined, 'S1 document 节恒失效（待重物化）');
  ok(m.interfaceOverview.diagramPng === 'PNG_IO' && m.callGraphs[0].diagramPng === 'PNG_CG', 'S1 图源一致的 PNG 回挂');
  ok(m.schemaVersion === 1, 'S1 schemaVersion 保留');
}

// ================= 场景 2：函数体变更 + 新增 + 删除 =================
{
  const old = model({
    providedFunctions: [fn('Keep', 's1', 'b1', true), fn('ChgBody', 's2', 'b2', true), fn('Del', 's3', 'b3', true)],
    internalFunctions: [fn('ChgSig', 's4', 'b4', true)],
    functionalDescription: '旧5.1',
    dynamicDesign: { stateMachine: { name: 'SM' }, sequences: [] },
  });
  const nw = model({
    providedFunctions: [fn('Keep', 's1', 'b1'), fn('ChgBody', 's2', 'b2x'), fn('New', 's5', 'b5')],
    internalFunctions: [fn('ChgSig', 's4x', 'b4')],
  });
  const d = diffModules(old, nw);
  ok(d.hasChanges && d.dynamicInvalidated && d.descriptionInvalidated, 'S2 函数级变更：三标志全 true');
  ok(d.functions.unchanged.join() === 'Keep', 'S2 未变=Keep');
  ok(d.functions.changed.length === 2
    && d.functions.changed.find(c => c.name === 'ChgBody').kind === 'body'
    && d.functions.changed.find(c => c.name === 'ChgSig').kind === 'sig', 'S2 变更分类 body/sig 正确');
  ok(d.functions.added.join() === 'New' && d.functions.removed.join() === 'Del', 'S2 新增/删除正确');

  const m = applyModuleDiff(nw, old, d);
  ok(m.providedFunctions.find(f => f.name === 'Keep').generated?.detailedDescription === 'desc-Keep', 'S2 未变函数 generated 保留');
  ok(!m.providedFunctions.find(f => f.name === 'ChgBody').generated, 'S2 变更函数 generated 清空');
  ok(!m.providedFunctions.find(f => f.name === 'New').generated, 'S2 新增函数无 generated');
  ok(!m.providedFunctions.some(f => f.name === 'Del'), 'S2 删除函数不在合并产物中');
  ok(m.dynamicDesign === undefined, 'S2 动态设计失效');
  ok(m.functionalDescription === undefined, 'S2 5.1 描述失效');
  ok(typeof m.analyzedAt === 'string' && m.analyzedAt !== old.analyzedAt, 'S2 analyzedAt 为新值');
}

// ================= 场景 3：仅类型/配置变更（不波及动态设计） =================
{
  const old = model({
    providedFunctions: [fn('A', 's1', 'b1', true)],
    types: [typ('T1', 'uint8', true), typ('T2', 'uint16', true)],
    calledExternalFunctions: [ext('E1', 'void E1(void)', true)],
    configMacros: [cfg('C1', '1', true)],
    functionalDescription: '旧5.1',
    dynamicDesign: { stateMachine: { name: 'SM' }, sequences: [] },
  });
  const nw = model({
    providedFunctions: [fn('A', 's1', 'b1')],
    types: [typ('T1', 'uint32'), typ('T2', 'uint16')],   // T1 underlyingType 变
    calledExternalFunctions: [ext('E1', 'void E1(void)')],
    configMacros: [cfg('C1', '2')],                       // 值变
  });
  const d = diffModules(old, nw);
  ok(d.hasChanges && d.descriptionInvalidated, 'S3 类型/配置变更：hasChanges+descriptionInvalidated');
  ok(!d.dynamicInvalidated, 'S3 无函数变更：动态设计不失效');
  ok(d.types.changed.join() === 'T1' && d.types.unchanged.join() === 'T2', 'S3 类型变更名单正确');
  ok(d.configs.changed.join() === 'C1', 'S3 配置变更名单正确');

  const m = applyModuleDiff(nw, old, d);
  ok(!m.types.find(t => t.name === 'T1').generated, 'S3 变更类型 generated 清空');
  ok(m.types.find(t => t.name === 'T2').generated?.comment === 'tc-T2', 'S3 未变类型 generated 保留');
  ok(!m.configMacros.find(c => c.name === 'C1').generated, 'S3 变更配置 generated 清空');
  ok(m.dynamicDesign?.stateMachine?.name === 'SM', 'S3 动态设计保留');
  ok(m.providedFunctions[0].generated, 'S3 函数 generated 保留');
}

// ================= 场景 4：图源变化则 PNG 不回挂 =================
{
  const old = model({
    providedFunctions: [fn('A', 's1', 'b1', true)],
    interfaceOverview: { diagram: 'flowchart TD\nOLD', diagramFormat: 'mermaid', polarion: {}, diagramPng: 'PNG_OLD' },
  });
  const nw = model({
    providedFunctions: [fn('A', 's1', 'b1')],
    interfaceOverview: { diagram: 'flowchart TD\nNEW', diagramFormat: 'mermaid', polarion: {} },
  });
  const d = diffModules(old, nw);
  const m = applyModuleDiff(nw, old, d);
  ok(m.interfaceOverview.diagramPng === undefined, 'S4 图源变化：PNG 不回挂');
}

// ================= 场景 5：行号/注释位移不算变更（哈希口径验证） =================
{
  const old = model({ providedFunctions: [fn('A', 's1', 'b1', true)] });
  const moved = fn('A', 's1', 'b1');
  moved.lineStart = 100; moved.lineEnd = 200; moved.bodyText = '完全不同截断也无所谓';
  const nw = model({ providedFunctions: [moved] });
  const d = diffModules(old, nw);
  ok(!d.hasChanges && d.functions.unchanged.join() === 'A', 'S5 行号/bodyText 变化但哈希同 → 未变');
}

console.log(`\nmodelDiff 测试全部通过（${n} 项断言）`);
