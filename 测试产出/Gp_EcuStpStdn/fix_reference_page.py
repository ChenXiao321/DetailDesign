# -*- coding: utf-8 -*-
"""把 reference.docx 的页面设置改为 A4 + 12mm 页边距（与报告 HTML 的 @page 一致），
使 pandoc 输出的 docx 版心 ≈ 186mm ≈ 703px@96dpi，与 svg2png.py 的图宽上限 700px 对齐。"""
import os, re, zipfile, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(BASE, "reference.docx")
TMP = REF + ".tmp"

SECTPR = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
          '<w:pgMar w:top="680" w:right="680" w:bottom="680" w:left="680" '
          'w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>')

with zipfile.ZipFile(REF, "r") as z:
    xml = z.read("word/document.xml").decode("utf-8")

new_xml, n = re.subn(r"<w:sectPr.*?</w:sectPr>", SECTPR, xml, flags=re.S)
if n == 0:
    # 模板没有 sectPr 时插到 body 末尾
    new_xml = xml.replace("</w:body>", SECTPR + "</w:body>")
    n = 1
print("sectPr replaced:", n)

with zipfile.ZipFile(REF, "r") as zin, zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "word/document.xml":
            data = new_xml.encode("utf-8")
        zout.writestr(item, data)
shutil.move(TMP, REF)
print("done:", REF)
