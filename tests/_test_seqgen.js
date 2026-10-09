// 确定性序列图生成（零 LLM）：sequenceBuilder CFG 走查 + staticSequence 发射
// 覆盖：角色分支双图/自旋 NOP/条件原文守卫/else-if 拉平/编译期区域 opt/alt 包裹、
//       #endif 夹断兄弟区域（commonRpath 收缩）、cond 标签调用发消息、
//       GetCoreId 索引用法不分图、readSource 缺失 flat 降级
const fs = require('fs');
const path = require('path');
const { buildStaticSequence } = require('../packages/core/dist/generator/staticSequence.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; } else { fail++; failures.push(name + (detail ? ` :: ${String(detail).slice(0, 500)}` : '')); }
}

const FIX = path.join(__dirname, '_seqgen_fixture');
const readSource = (rel) => {
  try { return fs.readFileSync(path.join(FIX, rel), 'utf8'); } catch { return null; }
};
function fnLine(rel, name) {
  const lines = fs.readFileSync(path.join(FIX, rel), 'utf8').split('\n');
  const idx = lines.findIndex(l => l.includes(name) && /\)\s*$/.test(l));
  return idx + 1;
}
function mkFn(rel, name, calls) {
  const body = fs.readFileSync(path.join(FIX, rel), 'utf8');
  return {
    id: `M::${name}`, name, signature: `void ${name}(void)`, returnType: 'void', parameters: [],
    isStatic: false, file: rel, lineStart: fnLine(rel, name), lineEnd: fnLine(rel, name) + 5, comment: null,
    calls: calls ?? [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
    bodyText: body, bodyHash: '', sigHash: '',
    polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: name, workItemId: null },
  };
}
const mkExt = (name, group) => ({
  id: `X::${name}`, name, group, signature: `void ${name}(void)`, comment: null,
  polarion: { isWorkItem: false, chapter: '', workItemKind: 'external', title: '', workItemId: null },
});
function mkModel(fns) {
  return {
    module: 'Seq', analyzedAt: '', files: [],
    providedFunctions: fns, internalFunctions: [],
    internalVariables: [], providedVariables: [],
    calledExternalFunctions: [
      mkExt('Gp_RstM_InitOne', 'Gp_RstM'), mkExt('Gp_RstM_InitTwo', 'Gp_RstM'), mkExt('Gp_RstM_Init', 'Gp_RstM'),
      mkExt('Gp_TstApp_PreRunInit', 'Gp_TstApp'), mkExt('Gp_TstApp_RunTimePhase', 'Gp_TstApp'),
    ],
    types: [], configMacros: [], interfaceOverview: null, callGraphs: [], dynamicDesign: null,
  };
}

(async () => {
  // 1. Startup 式：角色分支 + 自旋 NOP + #if opt + else-if 拉平 + 兄弟区域 opt
  {
    const fn = mkFn('seq.c', 'Gp_Seq_Startup');
    const out = await buildStaticSequence(mkModel([fn]), fn, readSource, '初始化');
    check('startup:双图', out.parts.length === 2, JSON.stringify(out.parts.map(p => p.role)));
    check('startup:无降级无断言网', out.degraded === 'none' && !out.warnings.some(w => w.includes('断言网')), out.warnings.join('|'));
    const m = out.parts.find(p => p.role === '主核 Core0')?.diagram ?? '';
    const s = out.parts.find(p => p.role === '从核 satellite')?.diagram ?? '';
    check('startup:主核GetCoreId恰一条', (m.match(/GetCoreId\w*\(\)/g) || []).length === 1, m);
    check('startup:主核opt RSTM', m.includes('opt GP_SEQ_RSTM_SEL 生效时\n        Seq->>RstM: Gp_RstM_InitOne()'), m);
    check('startup:主核else-if拉平单alt', (m.match(/^ *alt /gm) || []).length === 1
      && m.includes('else Mst_ptst->SafeState_b == TRUE'), m);
    check('startup:主核alt整体包SAFETY', m.indexOf('opt GP_SEQ_SAFETY_ENABLE 生效时') < m.indexOf('alt Mst_ptst->TryPwrShdn_b == TRUE'), m);
    check('startup:主核兄弟区域MstPost独立opt', (m.match(/opt GP_SEQ_SAFETY_ENABLE 生效时/g) || []).length === 2
      && m.includes('opt GP_SEQ_SAFETY_ENABLE 生效时\n        Seq->>Seq: Gp_Seq_MstPost()'), m);
    check('startup:主核参与者首用序', m.indexOf('participant RstM as Gp_RstM') > 0
      && m.indexOf('participant RstM') < m.indexOf('participant TstApp'), m);
    check('startup:从核自旋NOP', /loop Sat_ptst->StpStage_t != GP_SEQ_STPSTAGE_TWO\n        Seq->>Seq: Gp_Seq_NOP\(\)/.test(s), s);
    check('startup:从核无主核调用', !s.includes('InitStageOneCore0') && s.includes('Gp_TstApp_PreRunInit()'), s);
    const md = out.parts.find(p => p.role === '主核 Core0')?.description ?? '';
    check('startup:主核描述中文事实', md.includes('初始化场景（主核 Core0）') && md.includes('Gp_RstM、Gp_TstApp')
      && /1 处条件分支（alt）/.test(md) && /3 处条件执行（opt）/.test(md), md);
    const sd = out.parts.find(p => p.role === '从核 satellite')?.description ?? '';
    check('startup:从核描述含循环计数', /1 处循环（loop）/.test(sd), sd);
  }

  // 2. MainFunction 式：cond 标签调用发消息（if (Chk() == FALSE)）
  {
    const fn = mkFn('seq.c', 'Gp_Seq_MainFunction');
    const out = await buildStaticSequence(mkModel([fn]), fn, readSource);
    const m = out.parts.find(p => p.role === '主核 Core0')?.diagram ?? '';
    const s = out.parts.find(p => p.role === '从核 satellite')?.diagram ?? '';
    check('main:双图', out.parts.length === 2, JSON.stringify(out.parts.map(p => p.role)));
    check('main:cond调用发消息在片段前',
      m.indexOf('Seq->>Seq: Gp_Seq_CalloutChkRunTime()') > 0
      && m.indexOf('Seq->>Seq: Gp_Seq_CalloutChkRunTime()') < m.indexOf('opt Gp_Seq_CalloutChkRunTime() == FALSE'), m);
    check('main:从核走else', s.includes('Gp_Seq_SatRunTimeProc()') && !s.includes('CalloutChkRunTime'), s);
  }

  // 3. IoM 式：GetCoreId 仅作参数（无角色比较）→ 单图
  {
    const fn = mkFn('seq.c', 'Gp_Seq_IomInit');
    const out = await buildStaticSequence(mkModel([fn]), fn, readSource);
    check('iom:单图', out.parts.length === 1 && out.parts[0].role === null, JSON.stringify(out.parts.map(p => p.role)));
    const d = out.parts[0]?.diagram ?? '';
    check('iom:含索引调用与opt', d.includes('Seq->>Seq: Gp_Seq_HwInit()')
      && d.includes('opt Gp_Seq_HwCheck(CoreId_u32) == E_OK') && d.includes('CalloutInitDone()'), d);
  }

  // 4. readSource 缺失 → flat 降级（fn.calls 顺序直发）
  {
    const fn = mkFn('seq.c', 'Gp_Seq_RegionAlt', ['Gp_RstM_InitTwo', 'CalloutSbcInit']);
    const out = await buildStaticSequence(mkModel([fn]), fn, () => null);
    check('flat:降级标记', out.degraded === 'flat', out.degraded);
    check('flat:描述注明兜底', (out.parts[0]?.description ?? '').includes('平铺兜底图')
      && (out.parts[0]?.description ?? '').includes('Gp_RstM'), out.parts[0]?.description);
    const d = out.parts[0]?.diagram ?? '';
    check('flat:按calls直发无片段', d.includes('Seq->>RstM: Gp_RstM_InitTwo()')
      && d.includes('Seq->>Seq: CalloutSbcInit()') && !d.includes('opt ') && !d.includes('alt '), d);
  }

  // 5. #endif 夹断：else 体逃出区域 → alt 不整包，分支内各自包（commonRpath 收缩）
  {
    const fn = mkFn('seq.c', 'Gp_Seq_Interleaved');
    const out = await buildStaticSequence(mkModel([fn]), fn, readSource);
    const d = out.parts[0]?.diagram ?? '';
    check('interleaved:单图', out.parts.length === 1, JSON.stringify(out.parts.map(p => p.role)));
    check('interleaved:alt顶层不整包', d.includes('    alt Mst_ptst->TryPwrShdn_b == TRUE\n'), d);
    check('interleaved:是支包SAFETY', d.includes('        opt GP_SEQ_SAFETY_ENABLE 生效时\n            Seq->>Seq: CalloutPwrShdn()\n        end'), d);
    check('interleaved:else支兄弟区域独立opt+区外调用',
      d.includes('    else\n        opt GP_SEQ_SAFETY_ENABLE 生效时\n            Seq->>Seq: Gp_Seq_MstProc()\n        end\n        Seq->>Seq: CalloutSbcInit()\n    end'), d);
  }

  // 6. #if/#else → alt 生效时/未生效时
  {
    const fn = mkFn('seq.c', 'Gp_Seq_RegionAlt');
    const out = await buildStaticSequence(mkModel([fn]), fn, readSource);
    const d = out.parts[0]?.diagram ?? '';
    check('regionAlt:alt两支', d.includes('alt GP_SEQ_RSTM_SEL 生效时\n        Seq->>RstM: Gp_RstM_InitTwo()\n    else 未生效时\n        Seq->>RstM: Gp_RstM_Init()\n    end'), d);
    check('regionAlt:无降级无断言网', out.degraded === 'none' && !out.warnings.some(w => w.includes('断言网')), out.warnings.join('|'));
  }

  console.log(`通过 ${pass} / ${pass + fail}`);
  if (failures.length) { console.log('FAIL:'); failures.forEach(f => console.log('  -', f)); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exitCode = 1; });
