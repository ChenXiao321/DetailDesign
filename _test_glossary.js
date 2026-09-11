// 术语表注入测试：外部缩写定义按 prompt 内出现过滤后注入文本类生成，图类 prompt 不注入
const { generateDesign } = require('./packages/core/dist/generator/designGenerator.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

function mkModel() {
  return {
    module: 'M', analyzedAt: '', files: [],
    providedFunctions: [{
      id: 'M::M_Init', name: 'M_Init', signature: 'void M_Init(void)', returnType: 'void', parameters: [],
      isStatic: false, file: 'm.c', lineStart: 1, lineEnd: 9, comment: null,
      calls: ['Spi_Setup'], calledBy: [], globalsAccessed: [], conditionalFlags: [],
      bodyText: 'void M_Init(void){ Spi_Setup(); }', bodyHash: '', sigHash: '',
      polarion: { isWorkItem: true, chapter: '5.2.3.2', workItemKind: 'function', title: 'M_Init', workItemId: null },
    }],
    internalFunctions: [], internalVariables: [], providedVariables: [],
    calledExternalFunctions: [], types: [], configMacros: [], interfaceOverview: null, callGraphs: [],
    dynamicDesign: null,
  };
}

const ABBR = [
  ['SPI', 'Serial Peripheral Interface 串行外设接口（外部口径）'],
  ['WDG', 'Watchdog 看门狗（外部口径）'],
  ['NEVERUSED', '永不出现的缩写'],
];

(async () => {
  // ① 函数描述 prompt：源码含 Spi_Setup → SPI 注入；WDG/NEVERUSED 不出现 → 不注入
  {
    const users = [];
    const provider = { name: 'fake', async generate(s, u) { users.push(u); return '这是一段足够长的函数功能描述，涉及 SPI 初始化。'; } };
    const model = mkModel();
    await generateDesign(model, provider, { only: ['M_Init'], failures: [], abbreviations: ABBR });
    const descPrompt = users[0];
    check('描述 prompt 注入 SPI 定义', descPrompt.includes('# 项目术语表') && descPrompt.includes('- SPI = Serial Peripheral Interface 串行外设接口（外部口径）'), descPrompt.slice(-300));
    check('不出现条目不注入', !descPrompt.includes('WDG =') && !descPrompt.includes('NEVERUSED'));
    check('注入在 prompt 末尾', descPrompt.trim().endsWith('（外部口径）'));
  }
  // ② 流程图 prompt 不注入（图源结构生成保持干净）
  {
    const users = [];
    const FLOW = 'flowchart TD\n    A(["开始"]) --> B["处理"]\n    B --> C(["结束"])';
    const provider = { name: 'fake', async generate(s, u) { users.push(u); return u.includes('flowchart') ? FLOW : '这是一段足够长的函数功能描述，长度超过二十字符。'; } };
    const model = mkModel();
    await generateDesign(model, provider, { only: ['M_Init'], failures: [], abbreviations: ABBR });
    check('描述+流程图两次调用', users.length === 2, `calls=${users.length}`);
    const fcPrompt = users[1] || '';
    check('流程图 prompt 无术语表', fcPrompt.length > 0 && !fcPrompt.includes('# 项目术语表'), fcPrompt.slice(-200));
  }
  // ③ 无 abbreviations 时 prompt 零变化（回归）
  {
    const users = [];
    const provider = { name: 'fake', async generate(s, u) { users.push(u); return '这是一段足够长的函数功能描述，不注入任何东西。'; } };
    await generateDesign(mkModel(), provider, { only: ['M_Init'], failures: [] });
    check('无术语表时 prompt 无注入块', !users[0].includes('# 项目术语表'));
  }
  console.log(`---- ${pass} PASS ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
