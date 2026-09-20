// 一次性：v7 预览的润色效果演示——用人工映射模拟 LLM 润色输出（真实效果等内网 Qwen 跑）
// 走与管线完全相同的 polishSmLabels 路径（校验/替换/重解析），改 json 后由 report 重出
const fs = require('fs');
const { polishSmLabels } = require('./packages/core/dist/generator/staticStateMachine.js');

// 模拟 LLM 润色输出（每条对照代码语义人工撰写，键=机械标签原文）
const MAP = {
  // EcuStp 主核
  'master set ECU is init stage two': 'master 完成阶段一初始化，置位阶段二',
  'MstImpl_ptst->TryPwrShdn_b == TRUE': 'master 检出试断电标志，执行断电流程（不再返回）',
  '!(MstImpl_ptst->TryPwrShdn_b == TRUE) && MstImpl_ptst->SafeState_b == TRUE': 'master 检出安全态标志，进安全态（不再返回）',
  '!(MstImpl_ptst->TryPwrShdn_b == TRUE) && !(MstImpl_ptst->SafeState_b == TRUE)': 'master 完成初始化与自检，置位阶段三',
  // EcuStp 从核
  'StpStage_t == GP_ECUSTPSHDN_STPSTAGE_TWO（自旋等待退出）': 'satellite 等到主核置位阶段二（自旋等待退出）',
  'StpStage_t == GP_ECUSTPSHDN_STPSTAGE_THREE（自旋等待退出）': 'satellite 等到主核置位阶段三（自旋等待退出）',
  // TLF35584
  '!(Data_pst->StatusData_tst.BistFunctCalled_u8 == FALSE) && !(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE) && …': 'BIST 已执行且设备未就绪，转等待态',
  'Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE': '设备进入 NORMAL 态',
  '!(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE) && Data_pst->ReInitRetry_u8 < GP_TLF35584_TRY_REINIT_MAX': '设备未就绪且重初始化次数未达上限，重新预运行',
  '!(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE) && !(Data_pst->ReInitRetry_u8 < GP_TLF35584_TRY_REINIT_MAX)': '设备未就绪且重初始化次数达上限，进错误态',
  '!(Data_pst->SetMode_u8 == GP_TLF35584_STANDBY_STATE) && Data_pst->SetMode_u8 == GP_TLF35584_NORMAL_STATE': 'ASW 经异步接口请求切 NORMAL 模式',
  // IoMcuAdc
  '(Ret_t == E_NOT_OK) || (FuncCompl_b == FALSE)': '硬件初始化失败或未完成',
  '!((Ret_t == E_NOT_OK) || (FuncCompl_b == FALSE))': '硬件初始化成功且完成',
};

const fakeLlm = {
  name: 'pseudo-qwen',
  async generate(system, user) {
    const input = JSON.parse(user.match(/```json\s*(\{[\s\S]*?\})\s*```/)[1]);
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (MAP[v]) out[k] = MAP[v];
      else console.log('  （无映射保持原文）' + v.slice(0, 60));
    }
    return JSON.stringify(out);
  },
};

(async () => {
  for (const m of ['Gp_EcuStpStdn', 'Gp_IoMcuAdc_3.2.0', 'Gp_TLF35584_5.0.3']) {
    const p = `内网测试/v7_状态机静态生成预览/${m}/lld_design.json`;
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const dd = d.dynamicDesign;
    const sms = dd.stateMachines ?? (dd.stateMachine ? [dd.stateMachine] : []);
    for (const sm of sms) {
      const warn = await polishSmLabels(sm, d.module, fakeLlm);
      console.log(`${m} ${sm.name}: ${warn ?? '润色完成'}`);
    }
    fs.writeFileSync(p, JSON.stringify(d, null, 1));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
