# -*- coding: utf-8 -*-
# 迁移包补丁-20260923-报告骨架物化.zip：1/2/3/7/8 章正文与各章引导句（含 3.1/3.2 缩写定义表）
# 物化进 design json 的 document 节——json 成报告唯一数据源，report/audit 不再现读缩写表配置
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = []
core_files = [
    'generator/staticDocument',      # 新增
    'generator/designGenerator',
    'report/htmlReport',
    'model/types',
    'index',
]
for f in core_files:
    files.append(f'packages/core/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/core/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/core/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/core/src/{f}.ts')
cli_files = ['index', 'audit']
for f in cli_files:
    files.append(f'packages/cli/src/{f}.ts')
    for ext in ['js', 'd.ts', 'js.map']:
        files.append(f'packages/cli/dist/{f}.{ext}')
        files.append(f'node_modules/@lld/cli/dist/{f}.{ext}')
    files.append(f'node_modules/@lld/cli/src/{f}.ts')

missing = [f for f in files if not os.path.isfile(f)]
if missing:
    print('!! 缺失:'); [print('  ', m) for m in missing]; sys.exit(1)

readme = '''迁移包补丁-20260923-报告骨架物化 —— 覆盖说明
================================================

■ 内容（全部为工具链改动，不含任何生成产物；需先打过 0922 补丁或同基线）
  报告骨架内容（1 目的 / 2 适用范围 / 3.1 缩写 / 3.2 定义 / 7 详细设计规范评估 /
  8 支持文件，以及各章引导句说明）在 gen 期物化进 lld_design.json 的 "document"
  节。物化后 report/audit 纯渲染只读 json，不再现读 lld.config.json 的缩写表——
  design json 成为报告的唯一数据源（json 归档即可完整复现报告）。

■ 语义变化（评审/运维请留意）
  - 缩写表改为 gen 期定型：维护方更新缩写表 docx 后，需重跑下方 ① 的
    gen --only document --resume（确定性零 LLM，秒级）才反映到报告；
    描述类内容重生成后同样需重刷（3.1 按文档实际出现过滤）。
  - 存量 design json 无 document 节时，report/audit 回退旧行为（report 期
    现读配置），产物与旧版字节一致，并打印一行提示。不物化也能照常使用。

■ 应用方法（内网）
  在迁移包解压目录上直接覆盖本补丁全部文件（目录结构一致）。

■ 内网刷新步骤（每个模块）
  ① 物化骨架内容（免 LLM，秒级）：
       node packages/cli/dist/index.js gen 测试模块/<模块> --out <产物目录> --only document --resume
     （--resume 必带：加载已有 lld_design.json 就地补 document 节）
  ② 出报告 + 渲染验收：
       node packages/cli/dist/index.js report 测试模块/<模块> --out <产物目录>
       node packages/cli/dist/index.js audit 测试模块/<模块> --out <产物目录>
  ③ 预期：报告与物化前逐字节一致（本地 8 产物双门禁已验证：legacy 现算与
     物化后渲染均与基线字节全同）；此后 document 节随 json 走，缩写表改动
     不再影响 report。

■ 兼容说明
  - 旧产物 json 不用改也能照常 report/audit（回退现算，产物字节一致）。
  - gen 全量跑时 document 节在末尾自动物化（无需单独跑 ①）。
'''

out = '迁移包补丁-20260923-报告骨架物化.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('覆盖说明.txt', readme)
    for f in files:
        z.write(f, f.replace('/', os.sep))
print(f'已生成 {out}（{len(files)+1} 条目，{os.path.getsize(out)//1024} KB）')
