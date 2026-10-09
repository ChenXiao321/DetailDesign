# -*- coding: utf-8 -*-
# 迁移包补丁-20260922-状态机描述中文化.zip：5.3.1.1 状态描述 + 5.3.1.2 迁移说明
# 并入 polishSmLabels 一次 LLM 调用——含 0921 序列图/状态机补丁全部内容
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
# 工具链改动（src + dist + node_modules/@lld 镜像）
core_files = [
    'analyzer/cfgBuilder',
    'analyzer/stateMachineBuilder',
    'analyzer/sequenceBuilder',
    'generator/designGenerator',
    'generator/staticStateMachine',
    'generator/staticSequence',
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

readme = '''迁移包补丁-20260922-状态机描述中文化 —— 覆盖说明（0922 版，取代此前全部补丁）
================================================

■ 内容（全部为工具链改动，不含任何生成产物；未打过 0917/0920/0921 的直接打本补丁）
  1. 【本补丁新增】状态机两张表的说明列中文化，并入状态机标签润色的同一次
     LLM 调用（不增加调用次数）：
       · 5.3.1.1 状态描述：原为宏注释英文原文或全空，现由 LLM 按状态全名+
         代码注释+存续期间执行的函数生成一句中文描述（≤40 字）；
       · 5.3.1.2 状态迁移说明列：原恒空，现由 LLM 按「从/到/触发条件+
         发生函数」写一句该迁移做什么（≤40 字）；
       · 与标签润色同一防线：失败/回显/超长/含图语法符一律保持原文
         （英文注释或空），不中断生成；图结构永远确定性、LLM 碰不到。
  2. （0921 已有）序列图生成改纯确定性（零 LLM），与流程图同一套路径：
     if/else→alt、if 无 else→opt、while/for/自旋等待→loop、编译期 #if
     区域→「宏 生效时/未生效时」包裹；消息=源码顺序调用、标签代码原文；
     多核分主核/从核两图；任意函数必出图（失败降级平铺）。序列图描述段
     同为工具确定性中文（入口函数、消息数、外部模块、控制结构计数）。
  3. （0921 已有）状态机生成改确定性结构提取 + LLM 仅润色标签：候选检测、
     CFG 抽象解释提取迁移、真终止判定+互补守护合并、初态边「上电复位」、
     非周期驱动机器补结束状态边 state→[*]。降级阶梯保证任意模块必出图。
  4. （0917 已有）条件编译虚线框归属修复 + 局部变量定义不进流程图。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网刷新步骤
  ① 状态机（含本次说明列中文化）：删掉 lld_design.json 的 "stateMachine"
     字段（及 "stateMachines" 若有），然后：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only dynamic --resume
  ② 序列图（免 LLM）：把 lld_design.json 的 "sequences": [...] 改为
     "sequences": []，然后同 ① 命令（①②可合并一次跑）。
  ③ 出报告 + 渲染验收：
       node packages/cli/dist/index.js report 测试模块/<模块> --out <产物目录>
       node packages/cli/dist/index.js audit 测试模块/<模块> --out <产物目录>

■ 生成结果口径说明（与旧 LLM 版的预期差异，评审时请留意）
  - 5.3.1.1/5.3.1.2 说明列由 LLM 撰写中文短句；Qwen 不可用时 5.3.1.1 保持
    宏注释英文原文、5.3.1.2 保持空，不中断。
  - 5.3.1.2 的「触发条件」与「说明」两列可能语义相近——说明列的价值在补充
    触发条件之外的语义（发生时机、结果、生命周期结束等）。
  - 序列图条件守卫是条件表达式原文；编译期区域标签为「宏名 生效时/未生效时」。
  - 状态机迁移触发条件经 LLM 润色为中文短句；从核图按代码实际路径画。
  - 初态边标签「上电复位」；非周期驱动机器末个置位函数返回处补 state→[*] 结束边。

■ 兼容说明
  - 旧产物 json 不用改也能照常 report/audit（渲染逻辑零改动，存量 json 重出
    报告与旧版字节一致）；只有重跑 gen 的条目才会换成新版内容。
  - 状态机/序列图分图后 5.3 会出现「主核 Core0」「从核 satellite」节，各为
    一个 Polarion 工作项。
'''

out = '迁移包补丁-20260922-状态机描述中文化.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
