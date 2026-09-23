# -*- coding: utf-8 -*-
# 迁移包补丁-20260923-图PNG物化.zip：全部六类 mermaid 图渲染成 PNG（2x base64）存回 design json
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
core_files = [
    'report/imageBatch',       # 新增：图收集/批量页/SVG 提取/截图参数（纯逻辑）
    'report/includeGraph',     # 新增：4.2 包含关系图源共享（自 htmlReport 抽取，零改动）
    'report/htmlReport',       # include 图改调 includeGraph；CSS 导出 REPORT_CSS
    'model/types',             # *Png 字段
    'index',
]
for f in core_files:
    files.append(f'packages/core/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/core/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/core/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/core/src/{f}.ts')
cli_files = [
    'images',                  # 新增：gen --only images 阶段（Edge I/O）
    'edge',                    # edgeDump/toFileUrl 自 audit 挪入 + edgeScreenshot 新增
    'audit',                   # 改从 edge.ts 导入（逻辑零改动）
    'index',                   # gen --only images 接线 + 帮助
]
for f in cli_files:
    files.append(f'packages/cli/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/cli/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/cli/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/cli/src/{f}.ts')

missing = [f for f in files if not os.path.isfile(f)]
if missing:
    print('!! 缺失:'); [print('  ', m) for m in missing]; sys.exit(1)

readme = '''迁移包补丁-20260923-图PNG物化 —— 覆盖说明
================================================

■ 内容（全部为工具链改动，不含任何生成产物；需先打过 0923 报告骨架物化补丁或同基线）
  除 mermaid 源码外，可把 lld_design.json 里全部六类图（函数流程图/功能接口总图/
  内部函数调用图/状态机/序列图/4.2 包含关系图）渲染成 PNG（2x）以 base64 存回
  design json —— json 归档即含成品图，不依赖浏览器再渲染。

■ 渲染口径
  与已验收报告完全一致的管线：报告同款 CSS + 内嵌 mermaid.min.js + 正交化后处理
  → Edge 无头批量渲染取 SVG → 逐图独立页 Edge --screenshot 出 PNG（默认 2x，
  超大图自动降 scale 避开浏览器 16384px 纹理上限）。
  HTML 报告渲染不变（仍浏览器端 mermaid 实时渲染），PNG 为归档/导出用途。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网使用步骤（每个模块，需 Edge，免 LLM）
  ① 先物化骨架内容（若尚未物化；4.2 包含关系图 PNG 存 document 节，缺节则该张跳过）：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only document --resume
  ② 图 PNG 物化：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only images --resume
     --resume 跳过已有 PNG 的图；单图失败不中断、末尾点名，重复本命令即可续跑补齐；
     不加 --resume 强制全部重渲。
  ③ 预期：每张图打印尺寸与大小，全部成功；design json 体积随 PNG 增长（base64）。

■ 兼容说明
  - 存量 design json 不跑本功能也能照常 report/audit（*Png 字段缺省不影响渲染）。
  - 本地验证：EcuStpStdn 26/26 张全出（Startup 大图 1734×7081 @2x 正常），
    流程图/状态机/序列图/包含关系图目检与报告一致；8 产物双字节门禁零回归。
'''

out = '迁移包补丁-20260923-图PNG物化.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
