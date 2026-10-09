# -*- coding: utf-8 -*-
# 迁移包整包重写：以 zip 内现有清单为基准，逐条从工作区读取最新内容重写，逐条字节核验。
# 另扫描 packages/{core,cli}/{src,dist} 与 测试模块 下 zip 未收的新文件，一并补入。
import zipfile, io, sys, os, hashlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ZIP = 'modu-迁移包.zip'
TMP = 'modu-迁移包.zip.tmp'

old = zipfile.ZipFile(ZIP)
names = old.namelist()
old_set = set(names)
# 元信息先全部取出并关闭句柄，否则 Windows 下 os.replace 被占用（WinError 32）
old_info = {n: (old.getinfo(n).date_time, old.getinfo(n).external_attr) for n in names}
old.close()

# 已删除功能：Polarion 同步层（2026-09-22 起下线）——相关条目整包剔除
DROP = [n for n in names if '/polarion/' in n or n.endswith('/pandoc.ts')
        or '/pandoc.' in n]
if DROP:
    print('-- 剔除已下线条目:')
    for d in DROP: print('  ', d)
    names = [n for n in names if n not in set(DROP)]
    old_set = set(names)

missing = [n for n in names if not os.path.isfile(n)]
if missing:
    print('!! zip 条目在工作区缺失:')
    for m in missing: print('  ', m)
    sys.exit(1)

# 扫描应同步目录里的新文件（node_modules/@lld/* 是 junction，os.walk 不自动跟随，须显式列根）
extra = []
for root in ['packages/core/src', 'packages/core/dist', 'packages/cli/src', 'packages/cli/dist', 'packages/cli/assets',
             'node_modules/@lld/core/src', 'node_modules/@lld/core/dist', 'node_modules/@lld/cli/src', 'node_modules/@lld/cli/dist',
             '测试模块']:
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            p = os.path.join(dirpath, f).replace(os.sep, '/')
            if p not in old_set:
                extra.append(p)
for e in extra:
    print('++ 新文件补入:', e)

# 根级工具脚本显式清单（不在扫描根内）：一键全流程 bat 包装（2026-10-09 起）
for f in ['lld-run.bat']:
    if os.path.isfile(f) and f not in old_set and f not in extra:
        extra.append(f)
        print('++ 新文件补入:', f)

all_names = names + extra
new = zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED)
bad = 0
for i, n in enumerate(all_names):
    with open(n, 'rb') as fh:
        data = fh.read()
    # 保留原压缩类型/外部属性
    dt, attr = old_info.get(n, ((2026, 9, 8, 12, 0, 0), 0o644 << 16))
    zi = zipfile.ZipInfo(n, date_time=dt)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = attr
    new.writestr(zi, data)
    bad = bad
new.close()

# 整包回读核验
chk = zipfile.ZipFile(TMP)
errs = chk.testzip()
assert errs is None, f'zip 完整性失败: {errs}'
mismatch = []
for n in all_names:
    disk = open(n, 'rb').read()
    if chk.read(n) != disk:
        mismatch.append(n)
if mismatch:
    print('!! 字节核验不一致:', mismatch)
    chk.close()
    sys.exit(1)
chk.close()
os.replace(TMP, ZIP)
print(f'[OK] 重写完成: {len(all_names)} 条目（原 {len(names)} + 新增 {len(extra)}），逐条字节核验全过')
print(f'     大小: {os.path.getsize(ZIP)/1024/1024:.2f} MB')
