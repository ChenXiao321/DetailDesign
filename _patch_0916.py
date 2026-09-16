# -*- coding: utf-8 -*-
# 迁移包补丁-20260916-静态流程图.zip：静态流程图生成器 + deDiag 渲染修复 + v4 补图 design json 回传
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
# 工具链改动（src + dist + node_modules/@lld 镜像）
core_files = [
    'analyzer/cfgBuilder', 'analyzer/flowchartEmitter', 'generator/staticFlowchart',
    'generator/designGenerator', 'index', 'llm/prompts', 'llm/provider', 'report/renderScript',
]
for f in core_files:
    files.append(f'packages/core/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/core/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/core/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/core/src/{f}.ts')
for f in ['index']:
    files.append(f'packages/cli/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/cli/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/cli/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/cli/src/{f}.ts')
files.append('部署说明.txt')
# v4 补图 design json 回传（Startup/Mainfunction/MstProcMcuPreRunTest 三图已本地静态生成补齐）
files.append('内网测试/Gp_EcuStpStdn_qwen_v4/lld_design.json')

missing = [f for f in files if not os.path.isfile(f)]
if missing:
    print('!! 缺失:'); [print('  ', m) for m in missing]; sys.exit(1)

readme = '''迁移包补丁-20260916-静态流程图 —— 覆盖说明
================================================

■ 内容
  1. 流程图生成改为确定性工具（不再调 LLM）：按 C 代码结构（tree-sitter AST →
     控制流图 → mermaid）生成，节点标签=代码原文，一次调用必出图。
     --only flowcharts 完全免 LLM（不需要 apiKey）。
  2. 渲染层修复：dagre 兜底路径首/末段斜线自动正交化（v4 Startup D0 菱形
     否支斜线→直角；11 产物重渲零回归）。
  3. Gp_EcuStpStdn_qwen_v4/lld_design.json：Startup/Mainfunction/
     MstProcMcuPreRunTest 三个函数的流程图已用静态生成器补齐（原来 LLM 三次
     重试失败、报告有描述无图）。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网验证步骤
  ① 免 LLM 静态出图冒烟（任意模块目录，无需 apiKey）：
       node packages/cli/dist/index.js gen 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_v5 --only flowcharts
     预期：12 个函数全部「重新生成流程图」，无 LLM 调用。
  ② 出报告+渲染验收：
       node packages/cli/dist/index.js report 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_v5
       node packages/cli/dist/index.js audit 测试模块/Gp_EcuStpStdn --out 测试产出/Gp_EcuStpStdn_v5
     预期：audit 打印斜线 0、交叉/穿盒/箭头全绿。
  ③ v4 补图确认：用补丁内 lld_design.json 覆盖内网
     Gp_EcuStpStdn_qwen_v4 产物目录同名文件后重跑 report+audit，
     Startup/Mainfunction/MstProcMcuPreRunTest 应出现流程图。

■ 注意
  - 存量已验收的 LLM 流程图不受影响；只有重跑 gen --only flowcharts 的函数
    会被替换。
  - 描述/动态设计/配置说明等文字内容仍需 LLM（apiKey 照常）。
'''

out = '迁移包补丁-20260916-静态流程图.zip'
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
z.writestr('覆盖说明.txt', readme)
for f in files:
    # v4 json 放到补丁内以模块名开头（照 0910 design 补丁惯例）
    arc = f.replace('内网测试/', '') if f.startswith('内网测试/') else f
    z.write(f, arc)
z.close()

# 逐条字节核验
z = zipfile.ZipFile(out)
bad = 0
for info in z.infolist():
    if info.filename == '覆盖说明.txt':
        continue
    src = '内网测试/' + info.filename if info.filename.startswith('Gp_EcuStpStdn_qwen_v4/') else info.filename
    with open(src, 'rb') as fh:
        if fh.read() != z.read(info.filename):
            print('!! 字节不符:', info.filename); bad += 1
print(f'[OK] {out}: {len(z.namelist())} 条目, {os.path.getsize(out)/1024:.0f} KB, 核验 {"全过" if bad == 0 else "失败"}')
z.close()
