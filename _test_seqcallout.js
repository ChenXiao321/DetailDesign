// 序列图 Callout 参与者 lint 测试：Callout 属本模块，不得建参与者（声明式/隐式都拦）
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');

const WITH_DECLARED_CO = `sequenceDiagram
    actor OS
    participant M as Gp_Demo
    participant CO as Callout
    OS->>M: Startup()
    M->>CO: CalloutGetCoreId()
    CO-->>M: CoreId`;
const WITH_IMPLICIT_CO = `sequenceDiagram
    actor OS
    OS->>M: Startup()
    M->>Callout: CalloutGetCoreId()`;
const SELF_CALL = `sequenceDiagram
    actor OS
    participant M as Gp_Demo
    OS->>M: Startup()
    M->>M: CalloutGetCoreId()`;

function mkModel() {
  return {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: ['CalloutGetCoreId'], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: 'void M_Init(void){ CalloutGetCoreId(); }', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    dynamicDesign: null,
  };
}

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

(async () => {
  // ① 声明式 Callout 参与者 → 拦下
  {
    const failures = [];
    await generateDesign(mkModel(), { name: 'fake', async generate() { return WITH_DECLARED_CO; } }, { only: ['dynamic'], failures });
    check('声明式 Callout 参与者被拦', failures.length === 1 && String(failures[0]).includes('不得把 Callout 列为参与者'), JSON.stringify(failures).slice(0, 120));
  }
  // ② 隐式 Callout 端点 → 拦下
  {
    const failures = [];
    await generateDesign(mkModel(), { name: 'fake', async generate() { return WITH_IMPLICIT_CO; } }, { only: ['dynamic'], failures });
    check('隐式 Callout 端点被拦', failures.length === 1 && String(failures[0]).includes('不得把 Callout 列为参与者'), JSON.stringify(failures).slice(0, 120));
  }
  // ③ 自调用画法 → 通过（消息文本含 Callout 函数名不误判）
  {
    const failures = [];
    const model = mkModel();
    await generateDesign(model, { name: 'fake', async generate() { return SELF_CALL; } }, { only: ['dynamic'], failures });
    const seqs = model.dynamicDesign && model.dynamicDesign.sequences || [];
    check('自调用画法通过', seqs.length === 1 && failures.length === 0, JSON.stringify(failures).slice(0, 120));
  }
  // ④ v3 真实序列图（带 participant CO as Callout）→ 拦下
  {
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('内网测试/Gp_EcuStpStdn_qwen_v3/lld_design.json', 'utf-8'));
    const real = m.dynamicDesign.sequences[0].diagram;
    const fn = m.providedFunctions.find(f => /_Startup$/i.test(f.name));
    const model = mkModel();
    model.providedFunctions[0].bodyText = fn.bodyTextWithPP || fn.bodyText;
    const failures = [];
    await generateDesign(model, { name: 'fake', async generate() { return real; } }, { only: ['dynamic'], failures });
    check('v3 真实图被拦', failures.length === 1 && String(failures[0]).includes('不得把 Callout 列为参与者'), JSON.stringify(failures).slice(0, 120));
  }
  console.log(`---- ${pass} PASS ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
