// 状态机按核角色分图（09-17 用户定调：多核模块 master/satellite 各画一张，对齐序列图分图惯例）
// 覆盖：gen 拆分入库 / 单图兼容形态 / 分图缺 stateDiagram-v2 起始行的校验拦截 / report 渲染 / polarion 收集
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');
const { generateHtmlReport } = require('./packages/core/dist/report/htmlReport.js');
const { collectWorkItems } = require('./packages/core/dist/polarion/collect.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; } else { fail++; failures.push(name + (detail ? ` :: ${String(detail).slice(0, 300)}` : '')); }
}

function baseModel() {
  return {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: 'x', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    // 状态机 prompt 的触发条件：枚举式 typedef（≥3 个关联宏）
    types: [{
      id: 'M::M_StpStageType', name: 'M_StpStageType', kind: 'typedef', underlyingType: 'uint8',
      comment: '启动阶段', file: 'm.h',
      relatedDefines: [
        { name: 'M_STPSTAGE_UNDEF', value: '0', comment: 'undefined' },
        { name: 'M_STPSTAGE_ONE', value: '1', comment: 'stage one' },
        { name: 'M_STPSTAGE_TWO', value: '2', comment: 'stage two' },
      ],
      polarion: { isWorkItem: false, chapter: '', workItemKind: 'type', title: '', workItemId: null },
    }],
    dynamicDesign: null,
  };
}

const TWO_ROLE_SM = [
  '### 主核 Core0',
  'stateDiagram-v2',
  '    [*] --> UNDEF : 上电复位',
  '    UNDEF --> ONE : 进入 Startup',
  '    ONE --> TWO : master 完成阶段一初始化',
  '### 从核 satellite',
  'stateDiagram-v2',
  '    [*] --> UNDEF : 上电复位',
  '    UNDEF --> ONE : 进入 Startup',
  '    ONE --> TWO : satellite 自旋等待主核屏障',
].join('\n');

const SINGLE_SM = 'stateDiagram-v2\n    [*] --> UNDEF : 上电复位\n    UNDEF --> ONE : 进入 Startup';

function fakeProvider(smText) {
  return {
    name: 'fake',
    async generate(system, user) {
      if (user.includes('stateDiagram')) return smText;
      if (user.includes('sequenceDiagram')) return 'sequenceDiagram\n    actor A as OS\n    A->>F: M_Init()';
      return '描述';
    },
  };
}

(async () => {
  // 1. 双角色分图：拆成 2 张入库，stateMachine 兼容位=第一张（主核）
  {
    const model = baseModel();
    const failures = [];
    await generateDesign(model, fakeProvider(TWO_ROLE_SM), { only: ['dynamic'], failures });
    const dd = model.dynamicDesign;
    check('分图:无失败', failures.length === 0, failures.join('|'));
    check('分图:stateMachines两张', dd.stateMachines?.length === 2, JSON.stringify(dd.stateMachines?.map(s => s.name)));
    check('分图:兼容位是主核', dd.stateMachine?.name === 'M 状态机（主核 Core0）', dd.stateMachine?.name);
    check('分图:兼容位与列表同内容', dd.stateMachine?.diagram === dd.stateMachines?.[0]?.diagram);
    check('分图:从核图内容', dd.stateMachines?.[1]?.diagram.includes('自旋等待主核屏障'));
    check('分图:polarion章节', dd.stateMachines?.every(s => s.polarion.chapter === '5.3.1' && s.polarion.workItemKind === 'statemachine'));
    check('分图:迁移解析', dd.stateMachines?.[0]?.transitions.length === 3 && dd.stateMachines?.[1]?.transitions.length === 3,
      JSON.stringify(dd.stateMachines?.map(s => s.transitions)));
    check('分图:迁移触发条件', dd.stateMachines?.[0]?.transitions[2]?.trigger === 'master 完成阶段一初始化');
  }

  // 2. 单图（无 ### 行）：stateMachines 不写，形态与旧版一致
  {
    const model = baseModel();
    await generateDesign(model, fakeProvider(SINGLE_SM), { only: ['dynamic'], failures: [] });
    const dd = model.dynamicDesign;
    check('单图:stateMachine在位', dd.stateMachine?.name === 'M 状态机', dd.stateMachine?.name);
    check('单图:不写stateMachines', dd.stateMachines === undefined, JSON.stringify(Object.keys(dd)));
  }

  // 3. 分图但第二段缺 stateDiagram-v2 起始行 → 校验拦截（重试耗尽收失败，stateMachine 落空）
  {
    const model = baseModel();
    const failures = [];
    const bad = TWO_ROLE_SM.replace(/### 从核 satellite\nstateDiagram-v2/, '### 从核 satellite');
    await generateDesign(model, fakeProvider(bad), { only: ['dynamic'], failures });
    check('拦截:记失败', failures.some(f => f.startsWith('dynamic')), JSON.stringify(failures).slice(0, 200));
    check('拦截:动态设计整体跳过待resume', model.dynamicDesign === null || model.dynamicDesign.stateMachine === null);
  }

  // 3b. 触发条件是裸函数名/裸英文 → 内容硬校验拦截（09-17 内网 v6 根因：prompt 引导不强制）
  {
    const model = baseModel();
    const failures = [];
    const bad = SINGLE_SM.replace('进入 Startup', 'M_Init()');
    await generateDesign(model, fakeProvider(bad), { only: ['dynamic'], failures });
    check('拦截裸函数名:记失败', failures.some(f => f.startsWith('dynamic')), JSON.stringify(failures).slice(0, 200));
    check('拦截裸函数名:不入库', model.dynamicDesign === null || model.dynamicDesign.stateMachine === null);
  }

  // 3c. 两角色分图内容完全相同 → 雷同拦截（分图必须体现角色差异）
  {
    const model = baseModel();
    const failures = [];
    const dup = [
      '### 主核 Core0', 'stateDiagram-v2',
      '    [*] --> UNDEF : 上电复位', '    UNDEF --> ONE : 进入 Startup',
      '### 从核 satellite', 'stateDiagram-v2',
      '    [*] --> UNDEF : 上电复位', '    UNDEF --> ONE : 进入 Startup',
    ].join('\n');
    await generateDesign(model, fakeProvider(dup), { only: ['dynamic'], failures });
    check('拦截雷同:记失败', failures.some(f => f.startsWith('dynamic')), JSON.stringify(failures).slice(0, 200));
    check('拦截雷同:不入库', model.dynamicDesign === null || model.dynamicDesign.stateMachine === null);
  }

  // 4. report 渲染：双角色各一个 5.3.1 节；单图渲染与旧版格式逐字节一致
  {
    const model2 = baseModel();
    await generateDesign(model2, fakeProvider(TWO_ROLE_SM), { only: ['dynamic'], failures: [] });
    const html2 = generateHtmlReport(model2);
    check('渲染:两节', (html2.match(/5\.3\.1 状态机：/g) || []).length === 2);
    check('渲染:两节标题', html2.includes('5.3.1 状态机：M 状态机（主核 Core0）') && html2.includes('5.3.1 状态机：M 状态机（从核 satellite）'));
    check('渲染:状态表只出一次', (html2.match(/5\.3\.1\.1 状态描述/g) || []).length === 1);
    // 迁移表合并两角色去重：[*]→UNDEF 与 UNDEF→ONE 两图相同，ONE→TWO 各一条 → 4 行
    const transTable = html2.match(/5\.3\.1\.2 状态迁移[\s\S]*?<\/table>/)?.[0] ?? '';
    check('渲染:迁移表合并4行', (transTable.match(/<tr><td><code>/g) || []).length === 4, transTable.slice(0, 400));
    check('渲染:迁移表含两角色触发', transTable.includes('master 完成阶段一初始化') && transTable.includes('satellite 自旋等待主核屏障'));

    const model1 = baseModel();
    await generateDesign(model1, fakeProvider(SINGLE_SM), { only: ['dynamic'], failures: [] });
    const html1 = generateHtmlReport(model1);
    check('渲染:单图一节', (html1.match(/5\.3\.1 状态机：/g) || []).length === 1);
    // 旧版格式逐字节锚点：h3 行紧跟图源（中间无额外包装）
    check('渲染:单图旧格式', html1.includes('<h3>5.3.1 状态机：M 状态机 <span class="badge">工作项 · 5.3.1</span></h3>\n<pre class="plantuml">stateDiagram-v2'), html1.match(/5\.3\.1 状态机[\s\S]{0,150}/)?.[0]);
  }

  // 5. polarion 收集：两张状态机各成一个工作项
  {
    const model = baseModel();
    await generateDesign(model, fakeProvider(TWO_ROLE_SM), { only: ['dynamic'], failures: [] });
    const items = collectWorkItems(model);
    const smItems = items.filter(w => w.kind === 'statemachine');
    check('polarion:两个状态机工作项', smItems.length === 2, JSON.stringify(items.map(w => w.title ?? w.name)).slice(0, 300));
  }

  console.log(`\n通过 ${pass} / ${pass + fail}`);
  if (failures.length) { console.log('失败明细:'); for (const f of failures) console.log('  ✗ ' + f); }
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
