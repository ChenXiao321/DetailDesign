// 一次性：验证 extractMermaid 的无样式 subgraph 自动补透明样式兜底
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');

const fakeFlow = [
  'flowchart TD',
  '    A(["开始"])',
  '    subgraph LOOP_BODY[" "]',
  '        direction TB',
  '        B["x"]',
  '    end',
  '    subgraph SG1[" "]',
  '        SG1_NOTE["注：仅在 X 时参与编译"]',
  '        SG1_NOTE ~~~ B',
  '    end',
  '    A --> B',
  '    style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4',
].join('\n');

(async () => {
  const model = {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::f', name: 'f', signature: 'void f(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: [], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: 'x', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'f', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
  };
  const provider = {
    name: 'fake',
    async generate(system, user) {
      if (user.includes('流程图')) return fakeFlow;
      return '描述';
    },
  };
  await generateDesign(model, provider, { only: ['flowcharts'], skipExisting: false, failures: [] });
  const fc = model.providedFunctions[0].generated.flowchart;
  console.log(fc);
  const autoTransparent = /style LOOP_BODY fill:transparent,stroke:transparent/.test(fc);
  const sg1Untouched = (fc.match(/style SG1 fill:transparent,stroke:#888888,stroke-dasharray:6 4/g) || []).length === 1;
  console.log('LOOP_BODY 自动补透明:', autoTransparent ? 'PASS' : 'FAIL');
  console.log('SG1 已有虚线样式未被重复追加:', sg1Untouched ? 'PASS' : 'FAIL');
})();
