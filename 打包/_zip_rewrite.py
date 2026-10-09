# -*- coding: utf-8 -*-
# 迁移包整包重写：以 zip 内现有清单为基准，逐条从工作区读取最新内容重写，逐条字节核验。
# 另扫描 packages/{core,cli}/{src,dist} 下 zip 未收的新文件，一并补入。
# 本脚本位于 打包/ 目录：仓库根为工作区基准；打包自有的文件（本目录内）映射到 zip 根。
# 版本化（2026-10-09 起）：文件名 = modu-迁移包-v<package.json版本>-<git短hash>[-dirty].zip，
# 包内根级「版本.txt」记录版本/提交/构建时间/条目数；重打后自动清理本目录旧包。
import zipfile, io, sys, os, json, glob, subprocess, datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))   # 打包/
ROOT = os.path.dirname(HERE)                        # 仓库根

def git(*args):
    return subprocess.run(['git'] + list(args), cwd=ROOT,
                          capture_output=True, text=True).stdout.strip()

# ---- 版本信息 ----
ver = json.load(io.open(os.path.join(ROOT, 'package.json'), encoding='utf-8')).get('version', '0.0.0')
sha = git('rev-parse', '--short', 'HEAD')
subj = git('log', '-1', '--format=%s')
dirty_files = [l for l in git('status', '--porcelain').splitlines()
               if l.strip() and 'modu-迁移包' not in l]
dirty = bool(dirty_files)
built_at = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
ZIP = os.path.join(HERE, f"modu-迁移包-v{ver}-{sha}{'-dirty' if dirty else ''}.zip")
TMP = ZIP + '.tmp'

# 基准包：本目录内最新的既有迁移包
cands = [p for p in glob.glob(os.path.join(HERE, 'modu-迁移包*.zip')) if not p.endswith('.tmp')]
if not cands:
    print('!! 打包/ 下找不到既有迁移包作为基准（首个版本请先从旧清单种子生成）')
    sys.exit(1)
BASE = max(cands, key=os.path.getmtime)
print(f'基准包: {os.path.basename(BASE)}')
print(f'新版本: {os.path.basename(ZIP)}' + ('（工作区有未提交改动）' if dirty else ''))

# 打包自有文件：zip 根条目名 → 工作区实际路径（相对仓库根）
SRC_MAP = {
    '部署说明.txt': '打包/部署说明.txt',
    '启动命令行.bat': '打包/启动命令行.bat',
    'lld-run.bat': '打包/lld-run.bat',
}
def src_of(zip_name):
    return SRC_MAP.get(zip_name, zip_name)

old = zipfile.ZipFile(BASE)
names = old.namelist()
old_set = set(names)
# 元信息先全部取出并关闭句柄，否则 Windows 下 os.replace 被占用（WinError 32）
old_info = {n: (old.getinfo(n).date_time, old.getinfo(n).external_attr) for n in names}
old.close()

# 剔除规则（2026-10-09 起瘦身）：
#  ① 已下线的 Polarion/pandoc 条目
#  ② 测试模块示例源码（部署用不到，命令里的模块目录换成实际源码路径即可）
#  ③ 开发期依赖：typescript 编译器/@types 类型定义/.bin（产物已预编译进 dist）
#  ④ tree-sitter-wasms 里除 C 以外的 35 种语言语法包（工具只解析 C）
def droppable(n):
    if '/polarion/' in n or n.endswith('/pandoc.ts') or '/pandoc.' in n:
        return True
    if n.startswith('测试模块/'):
        return True
    if n.startswith(('node_modules/@typescript/', 'node_modules/typescript/',
                     'node_modules/@types/', 'node_modules/undici-types/',
                     'node_modules/.bin/')):
        return True
    if n.startswith('node_modules/tree-sitter-wasms/out/') and n.endswith('.wasm') \
            and not n.endswith('/tree-sitter-c.wasm'):
        return True
    return False

DROP = [n for n in names if droppable(n)]
if DROP:
    print(f'-- 剔除条目: {len(DROP)} 条（下线功能/示例模块/开发依赖/非C语言wasm）')
    names = [n for n in names if n not in set(DROP)]
    old_set = set(names)

missing = [n for n in names if not os.path.isfile(os.path.join(ROOT, src_of(n)))]
if missing:
    print('!! zip 条目在工作区缺失:')
    for m in missing: print('  ', m, '->', src_of(m))
    sys.exit(1)

# 扫描应同步目录里的新文件（node_modules/@lld/* 是 junction，os.walk 不自动跟随，须显式列根）
extra = []
for root in ['packages/core/src', 'packages/core/dist', 'packages/cli/src', 'packages/cli/dist', 'packages/cli/assets',
             'node_modules/@lld/core/src', 'node_modules/@lld/core/dist', 'node_modules/@lld/cli/src', 'node_modules/@lld/cli/dist']:
    for dirpath, _dirs, files in os.walk(os.path.join(ROOT, root)):
        for f in files:
            p = os.path.join(dirpath, f).replace(os.sep, '/')
            rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
            if rel not in old_set:
                extra.append(rel)
extra = [e for e in extra if not droppable(e)]
for e in extra:
    print('++ 新文件补入:', e)

# 版本.txt 每次构建重新生成（旧条目剔除）
names = [n for n in names if n != '版本.txt']
all_names = names + extra
GENERATED = {
    '版本.txt': (
        'Modu.LLD 迁移包\n'
        f'版本: v{ver}\n'
        f'代码提交: {sha} {subj}\n'
        f'构建时间: {built_at}\n'
        f'工作区状态: {"有未提交改动 (dirty)" if dirty else "干净"}\n'
        f'条目数: {len(all_names) + 1}\n'
        '内容: 部署精简版（工具链+运行时依赖；不含示例模块/开发依赖；Node 运行时需自备 ≥18，避开 v25.2.1）\n'
    ).encode('utf-8'),
}
all_names = all_names + list(GENERATED)

new = zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED)
for n in all_names:
    if n in GENERATED:
        data = GENERATED[n]
    else:
        with open(os.path.join(ROOT, src_of(n)), 'rb') as fh:
            data = fh.read()
    # 保留原压缩类型/外部属性
    dt, attr = old_info.get(n, ((2026, 9, 8, 12, 0, 0), 0o644 << 16))
    zi = zipfile.ZipInfo(n, date_time=dt)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = attr
    new.writestr(zi, data)
new.close()

# 整包回读核验
chk = zipfile.ZipFile(TMP)
errs = chk.testzip()
assert errs is None, f'zip 完整性失败: {errs}'
mismatch = []
for n in all_names:
    disk = GENERATED.get(n) or open(os.path.join(ROOT, src_of(n)), 'rb').read()
    if chk.read(n) != disk:
        mismatch.append(n)
if mismatch:
    print('!! 字节核验不一致:', mismatch)
    chk.close()
    sys.exit(1)
chk.close()
os.replace(TMP, ZIP)

# 清理本目录旧版本包（git 历史可追溯，本地不堆积）
for p in cands:
    if os.path.abspath(p) != os.path.abspath(ZIP):
        os.remove(p)
        print(f'-- 清理旧包: {os.path.basename(p)}')

print(f'[OK] 重写完成: {len(all_names)} 条目（原 {len(names)} + 新增 {len(extra)} + 版本.txt），逐条字节核验全过')
print(f'     大小: {os.path.getsize(ZIP)/1024/1024:.2f} MB')
