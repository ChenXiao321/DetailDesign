// 用存量 v5_修复预览 json 里的模型打印新状态机 prompt（确认驱动函数源码已注入）
const fs = require('fs');
const { buildStateMachinePrompt } = require('./packages/core/dist/llm/prompts.js');
const model = JSON.parse(fs.readFileSync('内网测试/v5_修复预览/lld_design.json', 'utf8'));
const r = buildStateMachinePrompt(model);
if (!r) { console.log('!! prompt 为 null（无状态候选）'); process.exit(1); }
console.log('=== prompt 长度:', r.user.length, '字符 ===');
console.log(r.user);
