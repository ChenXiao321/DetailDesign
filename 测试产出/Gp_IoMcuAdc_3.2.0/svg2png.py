# -*- coding: utf-8 -*-
"""将渲染后 HTML 中的内联 SVG 逐一光栅化为 PNG（Edge 无头截图），
再生成以 PNG 引用图片的 HTML，供 pandoc 转 docx。"""
import re, os, subprocess, math, sys

BASE = os.path.dirname(os.path.abspath(__file__))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FIGDIR = os.path.join(BASE, "figs")
os.makedirs(FIGDIR, exist_ok=True)

html = open(os.path.join(BASE, "lld_report.html"), encoding="utf-8").read()

svgs = list(re.finditer(r"<svg.*?</svg>", html, re.S))
print("svg count:", len(svgs))

def rasterize(idx, svg):
    tag = re.search(r"<svg[^>]*>", svg).group(0)
    mw = re.search(r'\bwidth="([\d.]+)"', tag)
    mh = re.search(r'\bheight="([\d.]+)"', tag)
    if mw and mh:
        w, h = float(mw.group(1)), float(mh.group(1))
    else:
        vb = re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', tag)
        if not vb:
            print("SKIP (no size):", tag[:120])
            return None
        w, h = float(vb.group(1)), float(vb.group(2))
    w, h = math.ceil(w), math.ceil(h)
    png = os.path.join(FIGDIR, "fig_%02d.png" % idx)
    page = os.path.join(FIGDIR, "fig_%02d.html" % idx)
    with open(page, "w", encoding="utf-8") as f:
        f.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
                '<style>html,body{margin:0;padding:0;background:#fff;}'
                'svg{display:block;}</style></head><body>' + svg + '</body></html>')
    cmd = [EDGE, "--headless", "--disable-gpu", "--hide-scrollbars",
           "--force-device-scale-factor=2",
           "--window-size=%d,%d" % (w, h),
           "--screenshot=" + png,
           "file:///" + page.replace("\\", "/")]
    r = subprocess.run(cmd, capture_output=True, timeout=120)
    if not os.path.exists(png) or os.path.getsize(png) < 500:
        print("FAIL fig_%02d" % idx, r.returncode, r.stderr.decode("utf-8", "ignore")[-200:])
        return None
    return w, h, png

out, pos, ok = [], 0, 0
for i, m in enumerate(svgs):
    res = rasterize(i, m.group(0))
    out.append(html[pos:m.start()])
    if res:
        w, h, png = res
        # A4 版心 ≈ 186mm ≈ 703px@96dpi：超宽图等比缩放显示尺寸，
        # 否则 docx 中图片超出页宽，右侧文字被裁（PNG 本身保持 2x 原尺寸，缩放不损清晰度）
        MAX_W = 700
        if w > MAX_W:
            h = math.ceil(h * MAX_W / w)
            w = MAX_W
        rel = "figs/fig_%02d.png" % i
        out.append('<p align="center" style="text-align:center"><img src="%s" style="width:%dpx;height:%dpx"/></p>' % (rel, w, h))
        ok += 1
    else:
        out.append(m.group(0))  # 保留原 SVG 兜底
    pos = m.end()
out.append(html[pos:])
open(os.path.join(BASE, "lld_report_for_docx.html"), "w", encoding="utf-8").write("".join(out))
print("rasterized:", ok, "/", len(svgs))
