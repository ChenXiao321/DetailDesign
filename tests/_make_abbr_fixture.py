# 重建 _test_fixture_abbr.docx：在原有两张缩写表基础上追加第三张「定义」表（表头 定义|描述），
# 模拟用户真实 docx（1.1 缩写 / 1.2 定义）结构。幂等：已含定义表则跳过。
import zipfile, shutil, sys, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_test_fixture_abbr.docx')

def row(cells):
    tcs = ''.join(
        f'<w:tc><w:tcPr /><w:p><w:pPr><w:pStyle w:val="Compact" /></w:pPr>'
        f'<w:r><w:t xml:space="preserve">{c}</w:t></w:r></w:p></w:tc>' for c in cells)
    return f'<w:tr>{tcs}</w:tr>'

zin = zipfile.ZipFile(SRC)
xml = zin.read('word/document.xml').decode('utf-8')
if '>master core<' in xml:
    print('fixture 已含定义表，跳过')
    sys.exit(0)

def_tbl = ('<w:tbl><w:tblPr />'
    + row(['定义', '描述'])
    + row(['master core', 'μC 上电时运行的 core。一般为 core0（同 MCAL 定义的 master core）。'])
    + row(['satellite core', '除 master core 以外的 core，配合 master core 工作。'])
    + '</w:tbl>')

marker = '<w:bookmarkEnd w:id="9" />'
assert marker in xml, '找不到插入锚点'
xml = xml.replace(marker, def_tbl + '\n    ' + marker)

# 整包重写（句柄先 close 再 replace，防 WinError 32）
items = [(n, zin.read(n)) for n in zin.namelist()]
zin.close()
with zipfile.ZipFile(SRC + '.tmp', 'w', zipfile.ZIP_DEFLATED) as zout:
    for n, data in items:
        zout.writestr(n, xml.encode('utf-8') if n == 'word/document.xml' else data)
shutil.move(SRC + '.tmp', SRC)
print('fixture 已追加定义表')
