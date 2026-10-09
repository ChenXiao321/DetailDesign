# -*- coding: utf-8 -*-
# 迁移包补丁-20260920-状态机确定性生成.zip：状态机改纯静态生成（零 LLM）——
# 含 0917 全部内容（条件编译虚线框归属修复 + 定义滤除 + 状态机分图约定的静态落地）
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
# 工具链改动（src + dist + node_modules/@lld 镜像）
core_files = [
    'analyzer/cfgBuilder',
    'analyzer/stateMachineBuilder',
    'generator/designGenerator',
    'generator/staticStateMachine',
    'llm/prompts', 'llm/provider',
    'model/types',
    'polarion/collect',
    'report/htmlReport',
    'index',
]
for f in core_files:
    files.append(f'packages/core/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/core/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/core/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/core/src/{f}.ts')
files.append('部署说明.txt')

missing = [f for f in files if not os.path.isfile(f)]
if missing:
    print('!! 缺失:'); [print('  ', m) for m in missing]; sys.exit(1)

readme = '''迁移包补丁-20260921-状态机确定性生成 —— 覆盖说明（0921 版，取代 0920/0917 补丁）
================================================

■ 内容（全部为工具链改动，不含任何生成产物；未打过 0917/0920 的直接打本补丁）
  1. 状态机生成改为确定性结构提取 + LLM 仅润色标签（0921 对照 v6 手绘风格校准）：
     结构与迁移零 LLM——从源码机械提取：候选检测（枚举 typedef 关联宏 /
     *_STATE|_MODE|_STAGE 宏族）、CFG 抽象解释提取迁移（赋值=迁移、switch case=
     迁移源、自旋等待 while(状态!=X)NOP 退出=迁移并标注「自旋等待退出」、
     PwrShdn/SafeState 类不返回分支=到 [*] 的提前终止）。
     迁移边标签默认是条件表达式原文；无条件迁移边用紧邻源码注释兜底（同行尾部
     或上方连续注释块，如 master set ECU is init stage two）。
     提取完成后每张图一次 LLM 调用做中文润色（忠实布尔语义、宏留核心词、
     Callout 名保留、句式「master/satellite + 动作描述」）：
       · 迁移边标签（条件表达式/英文注释 → 中文短句）
       · 无标签裸边补一句动作描述（上下文=所在函数名+目标状态内容调用，
         全部取自代码事实，不发明结构；如 UNDEF→ONE 补「master 初始化启动
         数据并置位阶段一」）
       · 状态内容行（`X : X——执行 a()、b()` 的函数列表概括为一句话，
         `X : X——` 前缀构造性保留）
     润色任一环节失败（无 JSON/超长/含 mermaid 语法符/行数变化）保持原文，
     不影响生成。mock 模式润色为恒等映射（标签不变、裸边不补）。
     初态边标签为「上电复位」（0921 起，对照 v6 手绘口径）。
     结束状态边：状态机不被 MainFunction 族周期驱动时，最后一个置位状态的
     初始化函数执行完毕返回即状态机生命周期结束 → 出口状态自动补一条到 [*]
     的结束边（0921 定调「状态机应有起始和结束状态」；如 EcuStp 主核
     THREE→[*]「阶段三无动作，函数返回」，依据=阶段三段为 /*do nothing*/
     且函数随后 return）。周期驱动机器（如 TLF MainFunction）不补。
     多核模块按 GetCoreId 角色分支自动分主核/从核两张图（分支内状态行为无差异则不
     分，如 IoM 的 GetCoreId 索引用法）。
     降级阶梯保证任意模块必出图、gen 永不因状态机中断：CFG 失败的函数走行级正则
     兜底；完全无迁移时出状态清单图；模块无状态机则 5.3.1 不出节（同现状）。
  2. 状态内容行（某状态存续期间调用的函数，格式 `X : X——执行 a()、b()`）与迁移
     触发条件是两个补充信息通道；状态机图不画 note 注释框（构造性保证）。
  3. （0917 已有）条件编译虚线框归属修复：if/else 被 #endif 夹断的写法，条件菱形
     按头部所在行归属画进框内。
  4. （0917 已有）局部变量定义不进流程图：int x = 0 / 指针取地址等 declaration
     语句不画；赋值/调用/控制流照常；for 循环初始化器不受影响。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网刷新步骤
  ① 流程图（免 LLM，直接刷）：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only flowcharts --resume
  ② 状态机：用文本编辑器打开产物目录的 lld_design.json，删掉
     "stateMachine": {...} 整个字段（及 "stateMachines" 若有），然后：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only dynamic --resume
     （--resume 自动保留已有序列图；状态机结构为确定性提取，同一源码必得同一骨架，
      不再有重试/失败清单问题。边标签润色每张图一次 LLM 调用，Qwen 不可用/响应
      异常时自动保持代码原文标签，不会中断。序列图部分不受影响）
  ③ 出报告 + 渲染验收：
       node packages/cli/dist/index.js report 测试模块/<模块> --out <产物目录>
       node packages/cli/dist/index.js audit 测试模块/<模块> --out <产物目录>
     预期：audit 斜线 0、交叉/穿盒/箭头全绿（存量已接受项除外）。

■ 生成结果口径说明（与旧 LLM 版的预期差异，评审时请留意）
  - 迁移触发条件经 LLM 润色为中文短句（如「master 检出试断电标志，执行断电
    流程（不再返回）」）；润色失败时保持条件表达式原文（如
    `MstImpl_ptst->TryPwrShdn_b == TRUE`）或紧邻源码注释。
  - 从核图按代码实际路径画：satellite 可能出现 UNDEF→TWO 直达（源码里从核没有
    置位 ONE 的语句，ONE 是主核置的），这是忠实于代码的结果。
  - switch 的 default 分支会展开为「未被 case 覆盖的状态各出一条迁移」；这类
    展开边无守护条件，润色时会补一句说明（如「未被 case 覆盖，default 分支回
    预运行态」）。
  - 初态边标签为「上电复位」；初态宏无数值 0 时初态边由 PreInit 的实际赋值推出
    （如 TLF [*]→INITIAL_TASK），同样参与润色。

■ 兼容说明
  - 旧产物 json 不用改也能照常 report/audit（渲染逻辑零改动，存量 json 重出报告
    与旧版字节一致）；只有重跑 gen 的条目才会换成新版内容。
  - 状态机分图后 5.3.1 会出现「主核 Core0」「从核 satellite」两节，
    各为一个 Polarion 工作项（章节号同为 5.3.1）。
'''

out = '迁移包补丁-20260921-状态机确定性生成.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
