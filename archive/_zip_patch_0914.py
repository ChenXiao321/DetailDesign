# -*- coding: utf-8 -*-
# 迁移包补丁-20260914-缩写表全量收录.zip：外部 docx「缩写+定义」两节全量入报告（src+dist 双副本）。
import zipfile, io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OUT = '迁移包补丁-20260914-缩写表全量收录.zip'

core_files = [
    'src/report/abbrDocx.ts', 'dist/report/abbrDocx.js', 'dist/report/abbrDocx.d.ts', 'dist/report/abbrDocx.js.map',
    'src/report/htmlReport.ts', 'dist/report/htmlReport.js', 'dist/report/htmlReport.d.ts', 'dist/report/htmlReport.js.map',
    'src/index.ts', 'dist/index.js', 'dist/index.js.map',
]
cli_files = [
    'src/config.ts', 'dist/config.js', 'dist/config.d.ts', 'dist/config.js.map',
    'src/index.ts', 'dist/index.js', 'dist/index.js.map',
    'src/audit.ts', 'dist/audit.js', 'dist/audit.js.map',
]
entries = []
for f in core_files:
    entries.append(f'packages/core/{f}')
    entries.append(f'node_modules/@lld/core/{f}')
for f in cli_files:
    entries.append(f'packages/cli/{f}')
    entries.append(f'node_modules/@lld/cli/{f}')
entries += ['部署说明.txt']

missing = [e for e in entries if not os.path.isfile(e)]
if missing:
    print('!! 缺失文件:')
    for m in missing: print('  ', m)
    sys.exit(1)

note = ('覆盖说明.txt', (
    '迁移包补丁-20260914-缩写表全量收录\n'
    '==============================\n'
    '覆盖内容（在 09-10 管线质量闭环补丁基础上直接解压覆盖即可；整包 09-11 之后的直接覆盖亦可）：\n'
    '1. 外部缩写表全量收录（用户反馈修复）：此前 3.1 只列「本模块实际出现」的外部表条目，\n'
    '   Word 里 ROM/RAM/ASIL/μC 等未在本文档出现的定义不会进报告。现改为：配置了\n'
    '   abbreviationsDoc 后，3.1 全量收录 docx「缩写」表全部条目，与 Word 表保持一致。\n'
    '2. docx「定义」表支持：docx 中第二张表（表头 名称/定义 | 描述，如 master core、\n'
    '   satellite core 等术语定义）现在会被正确识别为定义表，全量列入报告 3.2 节，\n'
    '   排在内置通用行（可重入性/静态全局变量）之前。修复旧版把「定义|描述」表当缩写表\n'
    '   且列序取反、内容被静默丢弃的缺陷。\n'
    '3. 不配置 abbreviationsDoc 时行为逐字节不变（内置 29 条词典合并+按出现过滤），\n'
    '   8 个存量产物 report 已验证字节级零回归。\n'
    '4. 表格分类规则：表头含「缩写/abbrev」列 → 缩写表进 3.1；表头整格为「名称/定义/术语」\n'
    '   → 定义表进 3.2；只有「描述/含义」列的无缩写列表、及完全无表头的表 → 仍按缩写表\n'
    '   取首两列（兼容旧形态）。\n'
    '5. 缺口检测不变：正文出现但外部表未定义的缩写照旧在 report/audit 打印名单。\n'
    '\n内网验证步骤：\n'
    '1. 应用补丁后重跑 report：3.1 应列出 docx 缩写表全部条目（含本文档未出现的），\n'
    '   3.2 应出现 docx 定义表的术语（master core 等），注释行写明「全量收录」。\n'
    '2. 删掉 lld.config.json 的 abbreviationsDoc 重跑，应恢复内置词典原行为。\n'
    '注意：本补丁只含工具链代码，不含任何 design json。\n'
))

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for e in entries:
        z.write(e, e)
    z.writestr(note[0], note[1].encode('utf-8'))

chk = zipfile.ZipFile(OUT)
assert chk.testzip() is None
for e in entries:
    assert chk.read(e) == open(e, 'rb').read(), e
chk.close()
print(f'[OK] {OUT}: {len(entries)+1} 条目，逐条字节核验全过，{os.path.getsize(OUT)/1024:.0f} KB')
