// 一次性：SM 描述中文化效果预览——人工映射模拟 Qwen 的 S/T 输出（真实效果等内网 Qwen 跑）
// 走与管线完全相同的 polishSmLabels 路径（校验/写回/重解析），输入用 v7 预览 json（英文/空描述现场）
const fs = require('fs');
const { polishSmLabels } = require('./packages/core/dist/generator/staticStateMachine.js');

// S 类：状态描述（按状态全名映射，对照交付件中文口径人工撰写）
const STATE_MAP = {
  GP_ECUSTPSHDN_STPSTAGE_UNDEF: '未定义状态，上电复位后的初始状态',
  GP_ECUSTPSHDN_STPSTAGE_ONE: '启动阶段一：master 初始化运行时缓冲区与启动数据',
  GP_ECUSTPSHDN_STPSTAGE_TWO: '启动阶段二：双核执行 PreRun 初始化与测试，master 完成初始化检查',
  GP_ECUSTPSHDN_STPSTAGE_THREE: '启动阶段三：satellite 完成自身初始化并记录时间戳',
};
// T 类：迁移说明（按角色 + from->to 映射）
const TRANS_MAP = {
  master: {
    '[*]->UNDEF': '上电复位后进入初始状态',
    'UNDEF->ONE': 'master 初始化启动数据并置位阶段一',
    'ONE->TWO': 'master 完成阶段一初始化后置位阶段二',
    'TWO->[*]': '检出试断电标志，执行断电流程，状态机生命周期结束',
    'TWO->THREE': 'master 完成阶段二全部处理，置位阶段三',
    'THREE->[*]': '阶段三无动作，函数返回，状态机生命周期结束',
  },
  satellite: {
    '[*]->UNDEF': '上电复位后进入初始状态',
    'UNDEF->TWO': 'satellite 自旋等待主核置位阶段二后解除等待',
    'TWO->THREE': 'satellite 自旋等待主核置位阶段三后解除等待',
    'THREE->[*]': '完成初始化并记录时间戳，函数返回，状态机生命周期结束',
  },
};

const mkFakeLlm = (smName) => ({
  name: 'pseudo-qwen',
  async generate(system, user) {
    const input = JSON.parse(user.match(/```json\s*(\{[\s\S]*?\})\s*```/)[1]);
    const out = {};
    const role = smName.includes('主核') ? 'master' : smName.includes('从核') ? 'satellite' : null;
    for (const [k, v] of Object.entries(input)) {
      if (k.startsWith('S')) {
        const name = v.match(/^状态 ([^（\s]+)/)?.[1];
        if (STATE_MAP[name]) out[k] = STATE_MAP[name]; else console.log('  （S 无映射保持原文）' + v.slice(0, 60));
      } else if (k.startsWith('T')) {
        const m = v.match(/^从 ([^，\s]+) 迁移到 ([^，\s]+)/);
        const hit = m && TRANS_MAP[role]?.[`${m[1]}->${m[2]}`];
        if (hit) out[k] = hit; else console.log('  （T 无映射保持原文）' + v.slice(0, 60));
      }
      // 数字/U/C 键不回显——回显拒绝防线保持既有润色结果不动
    }
    return JSON.stringify(out);
  },
});

(async () => {
  const p = '内网测试/v7_状态机静态生成预览/Gp_EcuStpStdn/lld_design.json';
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const dd = d.dynamicDesign;
  const sms = dd.stateMachines ?? (dd.stateMachine ? [dd.stateMachine] : []);
  for (const sm of sms) {
    const warn = await polishSmLabels(sm, d.module, mkFakeLlm(sm.name));
    console.log(`${sm.name}: ${warn ?? '润色完成'}`);
    console.log('  状态描述: ' + JSON.stringify(sm.states.map(s => s.description)));
    console.log('  迁移说明: ' + JSON.stringify(sm.transitions.map(t => t.description)));
  }
  fs.writeFileSync(p, JSON.stringify(d, null, 1));
  console.log('json 已写回: ' + p);
})().catch(e => { console.error(e); process.exitCode = 1; });
