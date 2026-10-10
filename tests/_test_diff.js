// 版本更新差异比对 + 失效合并测试（modelDiff 纯逻辑）
const assert = require('assert');
const { diffModules, applyModuleDiff, buildPolarionSync } = require('../packages/core/dist/index.js');

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

// ================= 场景 6：仅注释差异不算变更 + 富化注释回挂 =================
// （旧产物注释被管线富化/推断过——工具版本升级后重分析得到原始注释，不应误报变更）
{
  const oldT = typ('T1', 'uint8', true);
  oldT.comment = '定义 ECU 启动阶段的枚举类型（富化中文）';
  oldT.relatedDefines = [{ name: 'D1', value: '0x00U', comment: '阶段未定义（富化）' }];
  const oldE = ext('E1', 'void E1(void)', true);
  oldE.comment = { description: '复位管理器初始化（推断）' };
  oldE.commentSource = 'inferred';
  const old = model({ types: [oldT], calledExternalFunctions: [oldE], configMacros: [cfg('C1', '1', true)] });

  const newT = typ('T1', 'uint8');
  newT.comment = 'specifies the barrier status type';   // 原始 Doxygen 注释
  newT.relatedDefines = [{ name: 'D1', value: '0x00U', comment: null }];
  const newE = ext('E1', 'void E1(void)');
  newE.comment = null; delete newE.commentSource;        // 新分析器不带推断
  const newC = cfg('C1', '1'); newC.comment = '原始宏注释';
  const nw = model({ types: [newT], calledExternalFunctions: [newE], configMacros: [newC] });

  const d = diffModules(old, nw);
  ok(!d.hasChanges, 'S6 仅注释差异：hasChanges=false');
  ok(d.types.unchanged.join() === 'T1' && d.externals.unchanged.join() === 'E1' && d.configs.unchanged.join() === 'C1',
    'S6 三类条目全判未变');

  const m = applyModuleDiff(nw, old, d);
  ok(m.types[0].comment === '定义 ECU 启动阶段的枚举类型（富化中文）', 'S6 类型富化注释回挂');
  ok(m.types[0].relatedDefines[0].comment === '阶段未定义（富化）', 'S6 关联宏子注释回挂');
  ok(m.calledExternalFunctions[0].comment.description.includes('复位管理器初始化'), 'S6 外部接口推断注释回挂');
  ok(m.calledExternalFunctions[0].commentSource === 'inferred', 'S6 commentSource 回挂');
  ok(m.types[0].generated && m.calledExternalFunctions[0].generated && m.configMacros[0].generated,
    'S6 未变条目 generated 全保留');
}

// ================= 场景 7：Polarion 同步清单（操作翻译 + 疑似改名配对） =================
{
  const old = model({
    providedFunctions: [fn('Keep', 's1', 'b1', true), fn('ChgSig', 's2', 'b2', true), fn('OsErrRecov', 'sR', 'bR', true), fn('Del', 's3', 'b3', true)],
    internalFunctions: [fn('InnerChg', 's4', 'b4', true)],
    types: [typ('T1', 'uint8', true), typ('OldType', 'uint16', true)],
    configMacros: [cfg('C1', '1', true)],
  });
  const nw = model({
    providedFunctions: [fn('Keep', 's1', 'b1'), fn('ChgSig', 's2x', 'b2'), fn('OsErrRecov1', 'sR', 'bR'), fn('BrandNew', 's5', 'b5')],
    internalFunctions: [fn('InnerChg', 's4', 'b4x')],
    types: [typ('T1', 'uint32'), typ('OldTypeV2', 'uint16')],
    configMacros: [cfg('C1', '1')],
  });
  const d = diffModules(old, nw);
  const sync = buildPolarionSync(d, old, nw);
  const find = (title) => sync.operations.find(o => o.title === title);

  ok(find('OsErrRecov1')?.action === 'rename' && find('OsErrRecov1')?.from === 'OsErrRecov',
    'S7 函数疑似改名配对（OsErrRecov→OsErrRecov1，签名一致加权）');
  ok(!sync.operations.some(o => o.title === 'OsErrRecov'), 'S7 被配对删除项不再单列删除操作');
  ok(find('OldTypeV2')?.action === 'rename' && find('OldTypeV2')?.from === 'OldType' && find('OldTypeV2')?.chapter === '5.2.1.2',
    'S7 类型名称相似配对（OldType→OldTypeV2）');
  ok(find('Del')?.action === 'delete' && find('Del')?.chapter === '5.2.3.2', 'S7 孤立删除→delete 且章节按旧模型归属');
  ok(find('BrandNew')?.action === 'create', 'S7 孤立新增→create');
  ok(find('ChgSig')?.action === 'update' && find('ChgSig')?.detail.includes('签名变更'), 'S7 签名变更→update 带签名提示');
  ok(find('InnerChg')?.action === 'update' && find('InnerChg')?.chapter === '5.2.4.2', 'S7 内部函数章节 5.2.4.2');
  ok(find('T1')?.action === 'update' && find('T1')?.chapter === '5.2.1.2', 'S7 类型变更→update 章节 5.2.1.2');
  ok(sync.untouched.functions === 1 && sync.untouched.types === 0, 'S7 未变计数正确');
  const chapters = sync.operations.map(o => o.chapter);
  ok([...chapters].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join() === chapters.join(),
    'S7 操作单按章节号升序');
  ok(!sync.operations.some(o => o.title === 'Keep' || o.title === 'C1'), 'S7 未变条目不出现在操作单');
}

console.log(`\nmodelDiff 测试全部通过（${n} 项断言）`);
