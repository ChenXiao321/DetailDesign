// config 取值影响 prompt 规则测试（2026-11-10 用户定「prompt 修一下」）：
// 描述保留特例落地后，valueEffect 会被跨版本沿用——文本内禁止内嵌会过期的静态事实
//（使用处数/引用位置/被影响的函数变量名），防保留旧描述时与 usages/affects 字段自相矛盾。
const { buildConfigValueEffectPrompt } = require('../packages/core/dist/llm/prompts.js');

let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } };

const model = { module: 'M' };
const macro = {
  name: 'M_SAFETY_ENABLE', value: '(STD_ON)', isFunctionLike: false,
  comment: 'safety switch', file: 'm.h', kind: 'functional',
  usages: [
    { kind: 'condCompile', file: 'm.c', line: 42, context: '#if (M_SAFETY_ENABLE == STD_ON)' },
    { kind: 'condCompile', file: 'm.c', line: 99, context: '#if (M_SAFETY_ENABLE == STD_ON)' },
  ],
  affects: ['M_Init', 'M_Main'],
  polarion: { chapter: '6.2' },
};

const { user } = buildConfigValueEffectPrompt(model, macro);
const rules = user.slice(user.indexOf('# 输出要求'));

check('规则含禁嵌静态事实', rules.includes('禁止') && rules.includes('使用处数') && rules.includes('函数/变量名'), rules.slice(0, 200));
check('规则说明理由（结构化字段承载）', rules.includes('结构化字段') || rules.includes('使用方式/影响范围'), rules.slice(0, 200));
check('使用事实输入仍照常提供（供理解语境）', user.includes('条件编译裁剪: 2 处') && user.includes('M_Init, M_Main'), '');
check('既有输出要求不丢（控制行为/候选取值/依赖）', rules.includes('控制什么行为') && rules.includes('候选取值') && rules.includes('依赖关系'), rules.slice(0, 300));

console.log(`---- ${pass} PASS ${fail} FAIL`);
process.exit(fail ? 1 : 0);
