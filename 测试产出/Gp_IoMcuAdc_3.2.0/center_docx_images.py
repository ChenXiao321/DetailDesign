# -*- coding: utf-8 -*-
"""docx 后处理：把包含图片（w:drawing）的段落改为居中对齐。
pandoc 不识别 HTML 侧的 align/text-align，直接在 document.xml 的段落属性里补 <w:jc w:val="center"/>。"""
import re, os, zipfile, shutil, sys

BASE = os.path.dirname(os.path.abspath(__file__))
DOCX = os.path.join(BASE, sys.argv[1] if len(sys.argv) > 1 else "lld_report.docx")
TMP = DOCX + ".tmp"

with zipfile.ZipFile(DOCX, "r") as z:
    names = z.namelist()
    xml = z.read("word/document.xml").decode("utf-8")

# 逐段处理：含 <w:drawing> 的段落，在其 pPr 中加入居中（无 pPr 则新建）
def center_paragraph(m):
    p = m.group(0)
    if "<w:drawing>" not in p:
        return p
    if '<w:jc w:val="center"/>' in p:
        return p
    if "<w:pPr>" in p:
        # jc 需放在 pStyle 之后、其他属性之前的任意位置均可，这里直接追加到 pPr 末尾前
        return p.replace("</w:pPr>", '<w:jc w:val="center"/></w:pPr>', 1)
    return p.replace("<w:p>", "<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr>", 1)

# 段落可能带属性（<w:p ...>）或不带（<w:p>）
new_xml, n = re.subn(r"<w:p(?: [^>]*)?>.*?</w:p>", center_paragraph, xml, flags=re.S)
count = new_xml.count('<w:jc w:val="center"/>') - xml.count('<w:jc w:val="center"/>')
print("centered paragraphs added:", count)

with zipfile.ZipFile(DOCX, "r") as zin, zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "word/document.xml":
            data = new_xml.encode("utf-8")
        zout.writestr(item, data)
shutil.move(TMP, DOCX)
print("done:", DOCX)
