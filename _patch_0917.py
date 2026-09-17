# -*- coding: utf-8 -*-
# 迁移包补丁-20260917-流程图修订与状态机分图.zip：菱形虚线框归属修复 + 定义滤除 + 状态机按核角色分图（纯工具链，不含产物 json）
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
# 工具链改动（src + dist + node_modules/@lld 镜像）
core_files = [
    'analyzer/cfgBuilder',
    'generator/designGenerator',
    'llm/prompts', 'llm/provider',
    'model/types',
    'polarion/collect',
    'report/htmlReport',
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

readme = '''迁移包补丁-20260917-流程图修订与状态机分图 —— 覆盖说明
================================================

■ 内容（全部为工具链改动，不含任何生成产物）
  1. 条件编译虚线框归属修复：if/else 被 #endif 夹断的写法（else 体在 #if
     区外，Gp_EcuStpShdn_Startup 实测），条件菱形此前会漏到虚线框外，
     现在按菱形头部所在行归属，正确画进框内。
  2. 局部变量定义不再进流程图：int x = 0 / 指针取地址定义等 declaration
     语句一律不画（定义无流程语义），赋值/调用/控制流等真实操作照常；
     for 循环初始化器不受影响。
  3. 状态机按核角色分图：多核模块（master/Core0 与 satellite 行为不同）
     分别绘制主核/从核各一张状态机，各成一个工作项（对齐序列图分图惯例）；
     迁移触发条件改为语义化中文描述，不再只写裸函数名。单核模块无变化。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网刷新步骤
  ① 流程图（免 LLM，直接刷）：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only flowcharts --resume
  ② 状态机分图（需 LLM）：用文本编辑器打开产物目录的 lld_design.json，
     删掉 "stateMachine": {...} 整个字段（及 "stateMachines" 若有），然后：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only dynamic --resume
     （--resume 自动保留已有序列图，只重生状态机；生成后请人工目检新图——
      若仍只出一张或触发条件退回裸函数名，留生成日志反馈）
  ③ 出报告 + 渲染验收：
       node packages/cli/dist/index.js report 测试模块/<模块> --out <产物目录>
       node packages/cli/dist/index.js audit 测试模块/<模块> --out <产物目录>
     预期：audit 斜线 0、交叉/穿盒/箭头全绿。

■ 兼容说明
  - 旧产物 json 不用改也能照常 report/audit（单状态机渲染与旧版一致）；
    只有重跑 gen 的条目才会换成新版内容。
  - 状态机分图后 5.3.1 会出现「主核 Core0」「从核 satellite」两节，
    各为一个 Polarion 工作项（章节号同为 5.3.1）。
'''

out = '迁移包补丁-20260917-流程图修订与状态机分图.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
