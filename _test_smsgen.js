// 确定性状态机生成（零 LLM）：stateMachineBuilder CFG 抽象解释 + staticStateMachine 发射
// 覆盖：EcuStp 式双核分图（角色分支/自旋/提前终止/状态内容）、TLF 式 switch+default 展开单图、
//       IoM 式 GetCoreId 索引用法不分图、降级（无候选 null / 无迁移 L3 清单图）、report/polarion 兼容
const fs = require('fs');
const path = require('path');
const { buildStaticStateMachine, parseSmTransitions, polishSmLabels } = require('./packages/core/dist/generator/staticStateMachine.js');
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');
const { generateHtmlReport } = require('./packages/core/dist/report/htmlReport.js');
const { collectWorkItems } = require('./packages/core/dist/polarion/collect.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; } else { fail++; failures.push(name + (detail ? ` :: ${String(detail).slice(0, 400)}` : '')); }
}

const FIX = path.join(__dirname, '_smsgen_fixture');
const readSource = (rel) => {
  try { return fs.readFileSync(path.join(FIX, rel), 'utf8'); } catch { return null; }
};
/** 从夹具源文件找函数定义行号（1-based，与 locateFnCfg 的 clean 行对齐——夹具无多行注释压行） */
function fnLine(rel, name) {
  const lines = fs.readFileSync(path.join(FIX, rel), 'utf8').split('\n');
  const idx = lines.findIndex(l => l.includes(name) && /\)\s*$/.test(l));
  return idx + 1;
}
function mkFn(rel, name) {
  const body = fs.readFileSync(path.join(FIX, rel), 'utf8');
  return {
    id: `M::${name}`, name, signature: `void ${name}(void)`, returnType: 'void', parameters: [],
    isStatic: false, file: rel, lineStart: fnLine(rel, name), lineEnd: fnLine(rel, name) + 5, comment: null,
    calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
    bodyText: body, bodyHash: '', sigHash: '',
    polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: name, workItemId: null },
  };
}
function mkModel(module, fns, types) {
  return {
    module, analyzedAt: '', files: [],
    providedFunctions: fns, internalFunctions: [],
    internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    types, dynamicDesign: null,
  };
}
const mkTypedef = (name, defs) => ({
  id: `M::${name}`, name, kind: 'typedef', underlyingType: 'uint8', comment: null, file: 'm.h',
  relatedDefines: defs, polarion: { isWorkItem: false, chapter: '', workItemKind: 'type', title: '', workItemId: null },
});
const mkStruct = (name, field, typeName) => ({
  id: `M::${name}`, name, kind: 'struct', underlyingType: '', comment: null, file: 'm.h',
  elements: [{ name: field, type: typeName, description: '' }],
  polarion: { isWorkItem: false, chapter: '', workItemKind: 'type', title: '', workItemId: null },
});

(async () => {
  // 1. EcuStp 式：typedef 候选 + 角色分支 + 自旋 + 提前终止 → 双图
  {
    const model = mkModel('Ecu', [mkFn('ecu.c', 'Gp_Ecu_Startup')], [
      mkTypedef('GP_ECU_StpStageType', [
        { name: 'GP_ECU_STPSTAGE_UNDEF', value: '0', comment: 'undefined' },
        { name: 'GP_ECU_STPSTAGE_ONE', value: '1', comment: 'stage one' },
        { name: 'GP_ECU_STPSTAGE_TWO', value: '2', comment: 'stage two' },
        { name: 'GP_ECU_STPSTAGE_THREE', value: '3', comment: 'stage three' },
      ]),
      mkStruct('GP_ECU_DataType', 'StpStage_t', 'GP_ECU_StpStageType'),
    ]);
    const out = await buildStaticStateMachine(model, readSource);
    check('ecu:出图', !!out && out.sms.length === 2, JSON.stringify(out?.sms.map(s => s.name)) + ' | ' + JSON.stringify(out?.warnings));
    if (out && out.sms.length === 2) {
      const [m, s] = out.sms;
      check('ecu:主核名', m.name === 'Ecu 状态机（主核 Core0）', m.name);
      check('ecu:从核名', s.name === 'Ecu 状态机（从核 satellite）', s.name);
      check('ecu:初值', m.diagram.includes('[*] --> UNDEF : 复位初值'), m.diagram);
      const mT = m.transitions.map(t => `${t.from}->${t.to}:${t.trigger}`);
      check('ecu:主核UNDEF→ONE', mT.some(t => t.startsWith('UNDEF->ONE')), JSON.stringify(mT));
      check('ecu:主核ONE→TWO', mT.some(t => t.startsWith('ONE->TWO')), JSON.stringify(mT));
      check('ecu:无条件边注释兜底', mT.some(t => t === 'UNDEF->ONE:master set stage one') && mT.some(t => t === 'ONE->TWO:master set stage two'), JSON.stringify(mT));
      check('ecu:主核提前终止', mT.some(t => t === 'TWO->[*]:Mst_ptst->TryPwrShdn_b == TRUE'), JSON.stringify(mT));
      check('ecu:主核TWO→THREE守护原文', mT.some(t => t === 'TWO->THREE:!(Mst_ptst->TryPwrShdn_b == TRUE)'), JSON.stringify(mT));
      check('ecu:有守护不吃注释', !mT.some(t => t.includes('master set stage three')), JSON.stringify(mT));
      const sT = s.transitions.map(t => `${t.from}->${t.to}:${t.trigger}`);
      check('ecu:从核自旋退出迁移', sT.some(t => t.startsWith('UNDEF->TWO:StpStage_t == GP_ECU_STPSTAGE_TWO（自旋等待退出）')), JSON.stringify(sT));
      check('ecu:从核无赋值迁移', !sT.some(t => t.startsWith('UNDEF->ONE')), JSON.stringify(sT));
      check('ecu:从核提前终止', sT.some(t => t.startsWith('TWO->[*]:')), JSON.stringify(sT));
      check('ecu:主核ONE内容行', m.diagram.includes('ONE : ONE——执行 CalloutInitStageOneCore0()'), m.diagram);
      check('ecu:主核TWO内容行', m.diagram.includes('TWO : TWO——执行 Gp_TstApp_PreRunInit()'), m.diagram);
      check('ecu:从核UNDEF内容行', s.diagram.includes('UNDEF : UNDEF——执行 CalloutInitStageOneSat()'), s.diagram);
      check('ecu:禁note', !/^\s*note\s/m.test(m.diagram) && !/^\s*note\s/m.test(s.diagram));
      check('ecu:无降级', out.degraded === 'none', out.degraded + ' | ' + out.warnings.join('|'));
    }
  }

  // 2. TLF 式：宏族候选 + switch 驱动 + default 展开 → 单图
  {
    const model = mkModel('Tlf', [
      mkFn('tlf.c', 'Gp_Tlf_PreInit'), mkFn('tlf.c', 'Gp_Tlf_Init'), mkFn('tlf.c', 'Gp_Tlf_MainFunction'),
    ], []);
    const out = await buildStaticStateMachine(model, readSource);
    check('tlf:单图', !!out && out.sms.length === 1, JSON.stringify(out?.sms.map(s => s.name)) + ' | ' + JSON.stringify(out?.warnings));
    if (out && out.sms.length === 1) {
      const d = out.sms[0];
      check('tlf:无角色行', !d.diagram.includes('###'), d.name);
      const T = d.transitions.map(t => `${t.from}->${t.to}:${t.trigger}`);
      check('tlf:隐式状态初态迁移', T.some(t => t === '[*]->INITIAL_TASK:Init Memory'), JSON.stringify(T));
      check('tlf:INIT→WAIT', T.some(t => t === 'INITIAL_TASK->WAIT:wait for user to switch normal'), JSON.stringify(T));
      check('tlf:case守护RUN', T.some(t => t === 'PREPARERUN->RUN:Dev_u8 == GP_TLF_NORMAL_STATE'), JSON.stringify(T));
      check('tlf:case守护ERROR', T.some(t => t === 'PREPARERUN->ERROR:!(Dev_u8 == GP_TLF_NORMAL_STATE)'), JSON.stringify(T));
      check('tlf:default展开WAIT', T.some(t => t.startsWith('WAIT->PREPARERUN')), JSON.stringify(T));
      check('tlf:default展开INITIAL_TASK', T.some(t => t.startsWith('INITIAL_TASK->PREPARERUN')), JSON.stringify(T));
      check('tlf:NORMAL不展开', !T.some(t => t.startsWith('NORMAL->')), JSON.stringify(T));
      check('tlf:状态表5+1值', d.states.length === 6 && d.states.some(s => s.name === 'GP_TLF_INITIAL_TASK'), JSON.stringify(d.states.map(s => s.name)));
    }
  }

  // 3. IoM 式：GetCoreId 仅作索引（无比较分支）→ 不分图
  {
    const model = mkModel('Iom', [mkFn('iom.c', 'Gp_Iom_Init')], [
      mkTypedef('GP_IOM_InitStuType', [
        { name: 'GP_IOM_INITSTU_UNDEF', value: '0', comment: '' },
        { name: 'GP_IOM_INITSTU_INITED', value: '1', comment: '' },
        { name: 'GP_IOM_INITSTU_INIT_FAILED', value: '2', comment: '' },
      ]),
      mkStruct('GP_IOM_DataType', 'InitStu_t', 'GP_IOM_InitStuType'),
    ]);
    const out = await buildStaticStateMachine(model, readSource);
    check('iom:单图', !!out && out.sms.length === 1, JSON.stringify(out?.sms.map(s => s.name)));
    if (out && out.sms.length === 1) {
      const T = out.sms[0].transitions.map(t => `${t.from}->${t.to}:${t.trigger}`);
      check('iom:初值', out.sms[0].diagram.includes('[*] --> UNDEF : 复位初值'), out.sms[0].diagram);
      check('iom:守护INITED', T.some(t => t === 'UNDEF->INITED:Gp_Iom_HwInit(core) == E_OK'), JSON.stringify(T));
      check('iom:守护FAILED', T.some(t => t === 'UNDEF->INIT_FAILED:!(Gp_Iom_HwInit(core) == E_OK)'), JSON.stringify(T));
    }
  }

  // 4. 降级：无候选 → null；有候选无迁移 → L3 清单图
  {
    const noCand = mkModel('Nc', [mkFn('iom.c', 'Gp_Iom_Init')], []);
    noCand.providedFunctions[0].bodyText = 'void f(void) { int x = 0; }';
    check('降级:无候选null', (await buildStaticStateMachine(noCand, readSource)) === null);

    const noTrans = mkModel('Nt', [], [
      mkTypedef('GP_NT_StpType', [
        { name: 'GP_NT_STP_UNDEF', value: '0', comment: '' },
        { name: 'GP_NT_STP_A', value: '1', comment: '' },
        { name: 'GP_NT_STP_B', value: '2', comment: '' },
      ]),
      mkStruct('GP_NT_DataType', 'Stp_t', 'GP_NT_StpType'),
    ]);
    const out3 = await buildStaticStateMachine(noTrans, readSource);
    check('降级:L3清单图', !!out3 && out3.degraded === 'list' && out3.sms.length === 1, JSON.stringify(out3?.warnings));
    check('降级:L3含状态声明', !!out3 && out3.sms[0].diagram.includes('[*] --> UNDEF : 复位初值') && /^\s*A$/m.test(out3.sms[0].diagram), out3?.sms[0]?.diagram);
  }

  // 5. gen 接线 + report/polarion 兼容（--only dynamic：SM 静态生成不调 LLM，序列图走假 provider）
  {
    const model = mkModel('Ecu', [mkFn('ecu.c', 'Gp_Ecu_Startup')], [
      mkTypedef('GP_ECU_StpStageType', [
        { name: 'GP_ECU_STPSTAGE_UNDEF', value: '0', comment: 'undefined' },
        { name: 'GP_ECU_STPSTAGE_ONE', value: '1', comment: 'stage one' },
        { name: 'GP_ECU_STPSTAGE_TWO', value: '2', comment: 'stage two' },
        { name: 'GP_ECU_STPSTAGE_THREE', value: '3', comment: 'stage three' },
      ]),
      mkStruct('GP_ECU_DataType', 'StpStage_t', 'GP_ECU_StpStageType'),
    ]);
    const providerCalls = [];
    const provider = {
      name: 'fake',
      async generate(system, user) {
        providerCalls.push(user);
        if (user.includes('序列图')) return 'sequenceDiagram\n    actor A as OS\n    participant F as Ecu\n    A->>F: Gp_Ecu_Startup()\n    loop [每通道]\n    F->>F: 处理\n    end';
        return '描述';
      },
    };
    await generateDesign(model, provider, { only: ['dynamic'], failures: [], readSource });
    const dd = model.dynamicDesign;
    check('gen:双图入库', dd?.stateMachines?.length === 2 && dd.stateMachine?.name.includes('主核'), JSON.stringify(dd?.stateMachines?.map(s => s.name)));
    check('gen:SM结构不调LLM（仅润色调）', providerCalls.filter(u => u.includes('状态机')).every(u => u.includes('润色')), providerCalls.map(u => u.slice(0, 20)).join('|'));
    check('gen:序列图仍在', dd?.sequences.length === 1, JSON.stringify(dd?.sequences?.length));
    check('gen:迁移解析入库', dd?.stateMachines?.[0]?.transitions.length === 5, JSON.stringify(dd?.stateMachines?.[0]?.transitions));

    const html = generateHtmlReport(model);
    check('report:两节', (html.match(/5\.3\.1 状态机：/g) || []).length === 2);
    check('report:状态表一次', (html.match(/5\.3\.1\.1 状态描述/g) || []).length === 1);
    const transTable = html.match(/5\.3\.1\.2 状态迁移[\s\S]*?<\/table>/)?.[0] ?? '';
    check('report:迁移表合并', (transTable.match(/<tr><td><code>/g) || []).length === 6, transTable.slice(0, 500));
    check('report:迁移表含自旋退出', transTable.includes('自旋等待退出'));
    check('report:迁移表含提前终止', transTable.includes('TryPwrShdn_b == TRUE'));

    const items = collectWorkItems(model);
    check('polarion:两个状态机工作项', items.filter(w => w.kind === 'statemachine').length === 2,
      JSON.stringify(items.map(w => w.title)).slice(0, 300));
  }

  // 6. LLM 润色标签：成功映射 / 垃圾响应保持原文 / mermaid 注入拦截
  {
    const mkSm = (diagram) => ({
      name: 'Ecu 状态机（主核 Core0）', diagram, diagramFormat: 'mermaid',
      states: [], transitions: parseSmTransitions(diagram), polarion: null,
    });
    const DIAG = [
      'stateDiagram-v2',
      '    [*] --> UNDEF : 复位初值',
      '    UNDEF --> ONE : master set stage one',
      '    TWO --> [*] : Mst_ptst->TryPwrShdn_b == TRUE',
      '    ONE : ONE——执行 CalloutInitStageOneCore0()',
    ].join('\n');

    const sm = mkSm(DIAG);
    const provider = {
      name: 'fake',
      async generate(system, user) {
        const input = JSON.parse(user.match(/```json\s*(\{[\s\S]*?\})\s*```/)[1]);
        const out = {};
        for (const [k, v] of Object.entries(input)) {
          out[k] = v.includes('TryPwrShdn') ? '检出试断电标志，执行断电流程'
            : v.includes('master set') ? '置位阶段一'
            : v.startsWith('执行 CalloutInitStageOneCore0') ? 'master 执行阶段一初始化（CalloutInitStageOneCore0）'
            : v;
        }
        return JSON.stringify(out);
      },
    };
    const warn = await polishSmLabels(sm, 'Ecu', provider);
    check('润色:无告警', warn === null, warn);
    check('润色:标签替换', sm.diagram.includes('UNDEF --> ONE : 置位阶段一') && sm.diagram.includes('检出试断电标志，执行断电流程'), sm.diagram);
    check('润色:复位初值不动', sm.diagram.includes('[*] --> UNDEF : 复位初值'));
    check('润色:内容行润色且状态名前缀保留', sm.diagram.includes('ONE : ONE——master 执行阶段一初始化（CalloutInitStageOneCore0）'), sm.diagram);
    check('润色:迁移表重解析', sm.transitions.some(t => t.trigger === '检出试断电标志，执行断电流程'), JSON.stringify(sm.transitions));

    const sm2 = mkSm(DIAG);
    const warn2 = await polishSmLabels(sm2, 'Ecu', { name: 'bad', async generate() { return '我不会输出JSON'; } });
    check('润色:垃圾响应告警', typeof warn2 === 'string' && warn2.includes('保持原文'), warn2);
    check('润色:垃圾响应原文不动', sm2.diagram === DIAG);

    const sm3 = mkSm(DIAG);
    const warn3 = await polishSmLabels(sm3, 'Ecu', { name: 'evil', async generate() { return '{"1":"a --> B::x","2":"ok"}'; } });
    check('润色:注入拦截', sm3.diagram.includes('UNDEF --> ONE : master set stage one') && sm3.diagram.includes('TWO --> [*] : ok'), sm3.diagram + ' | ' + warn3);
  }

  console.log(`\n通过 ${pass} / ${pass + fail}`);
  if (failures.length) { console.log('失败明细:'); for (const f of failures) console.log('  ✗ ' + f); }
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
