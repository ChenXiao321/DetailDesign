// 一次性：验证 dynamic 粒度化 skipExisting——状态机保留、空 sequences 重生成
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');

(async () => {
  const oldSM = {
    name: 'M 状态机', diagram: 'stateDiagram-v2\n    [*] --> A', diagramFormat: 'mermaid',
    states: [{ name: 'A', description: '旧状态机' }], transitions: [],
    polarion: { isWorkItem: true, chapter: '5.3.1', workItemKind: 'statemachine', title: 'M 状态机', workItemId: null },
  };
  const model = {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: ['X_SetUp'], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: 'x', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    dynamicDesign: { stateMachine: oldSM, sequences: [] },
  };
  const calls = [];
  const provider = {
    name: 'fake',
    async generate(system, user) {
      calls.push(user.slice(0, 30));
      if (user.includes('序列图')) return 'sequenceDiagram\n    actor A as OS\n    participant F as M\n    A->>F: M_Init()\n    loop [每通道]\n    F->>F: 处理\n    end';
      return '描述';
    },
  };
  await generateDesign(model, provider, { only: ['dynamic'], skipExisting: true, failures: [] });
  const smKept = model.dynamicDesign.stateMachine === oldSM;
  const seqRegen = model.dynamicDesign.sequences.length === 1 && model.dynamicDesign.sequences[0].diagram.includes('loop [每通道]');
  const smCalled = calls.some(c => c.includes('状态机'));
  console.log('状态机原对象保留:', smKept ? 'PASS' : 'FAIL');
  console.log('序列图重生成(带 loop 片段):', seqRegen ? 'PASS' : 'FAIL');
  console.log('状态机 LLM 未被调用:', !smCalled ? 'PASS' : 'FAIL');
})();
