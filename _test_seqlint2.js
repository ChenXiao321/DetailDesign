// 序列图组合片段硬校验测试：走 generateDesign(only:['dynamic']) + fake provider
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');

const FLAT = `sequenceDiagram
    actor A as OS
    participant F as M
    A->>F: M_Init
    F->>F: M_PreInit
    F-->>A: Return`;

const FRAGGED = `sequenceDiagram
    actor A as OS
    participant F as M
    A->>F: M_Init
    alt 唤醒源有效
        F->>F: M_PreInit
    else 无唤醒源
        F->>F: 走默认配置
    end
    loop 每个寄存器
        F->>F: 写入配置
    end
    F-->>A: Return`;

function mkModel(bodyText) {
  return {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: ['X_SetUp'], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText, bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    dynamicDesign: null,
  };
}
// 状态机 prompt 无枚举/宏族时返回 null（不调用 LLM），只跑序列图
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

(async () => {
  // 场景 1：有控制流函数 + 第一次平铺 → 重试收敛且回喂提示
  {
    const model = mkModel('void M_Init(void){ if(a){ X_SetUp(); } for(i=0;i<3;i++){ X_SetUp(); } }');
    let calls = 0, lastUser = '';
    const provider = { name: 'fake', async generate(s, u) { calls++; lastUser = u; return calls === 1 ? FLAT : FRAGGED; } };
    const failures = [];
    await generateDesign(model, provider, { only: ['dynamic'], failures });
    const seqs = model.dynamicDesign && model.dynamicDesign.sequences || [];
    check('平铺后重试收敛', seqs.length === 1 && seqs[0].diagram.includes('alt'), `calls=${calls} seqs=${seqs.length}`);
    check('回喂含组合片段提示', lastUser.includes('上次输出的问题') && lastUser.includes('组合片段'));
    check('无失败记录', failures.length === 0, JSON.stringify(failures).slice(0, 120));
  }
  // 场景 2：持续平铺 → 重试 3 次后进入 failures（不中断整批）
  {
    const model = mkModel('void M_Init(void){ if(a){ X_SetUp(); } }');
    let calls = 0;
    const provider = { name: 'fake', async generate() { calls++; return FLAT; } };
    const failures = [];
    await generateDesign(model, provider, { only: ['dynamic'], failures });
    check('持续平铺进 failures', failures.length === 1 && /组合片段|重试 3 次/.test(String(failures[0])), JSON.stringify(failures).slice(0, 150));
    check('调用次数=4(1+3重试)', calls === 4, `calls=${calls}`);
  }
  // 场景 3：无控制流函数 + 平铺图 → 不误报
  {
    const model = mkModel('void M_Init(void){ X_SetUp(); X_SetUp(); }');
    const provider = { name: 'fake', async generate() { return FLAT; } };
    const failures = [];
    await generateDesign(model, provider, { only: ['dynamic'], failures });
    const seqs = model.dynamicDesign && model.dynamicDesign.sequences || [];
    check('无控制流平铺不误报', seqs.length === 1 && failures.length === 0, JSON.stringify(failures).slice(0, 150));
  }
  // 场景 4：片段不配平被拦
  {
    const model = mkModel('void M_Init(void){ if(a){ X_SetUp(); } }');
    const provider = { name: 'fake', async generate() { return FRAGGED.replace(/\n    end\n    loop/, '\n    loop'); } };
    const failures = [];
    await generateDesign(model, provider, { only: ['dynamic'], failures });
    check('不配平被拦', failures.length === 1 && String(failures[0]).includes('不配平'), JSON.stringify(failures).slice(0, 150));
  }
  console.log(`---- ${pass} PASS ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
