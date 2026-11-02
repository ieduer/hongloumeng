#!/usr/bin/env python3
"""raw/*.jpg -> play/art/*.webp（石頭收服）。用法：cd <raw 的上層> && python3 post.py <輸出目錄>
靈石、誤讀妖做成墨色圓章（黑底羽化），標誌與段位做成圓幣；地圖、背景、模式橫幅照片式裁切。
模型常在角落畫假印章、假題字：CROP 逐張裁掉（左、上、右、下的比例）。"""
import os, sys
from PIL import Image, ImageFilter, ImageDraw, ImageOps, ImageChops
OUT = sys.argv[1]
CROP = {
    "map-p1": (0, 0, 0.15, 0),      # 右下假題字一列
    "map-p3": (0, 0, 0, 0.08),      # 右下假浮水印
    "map-p7": (0, 0, 0, 0.14),      # 右下印章
    "bg-board": (0, 0, 0, 0.14),    # 右下印章
    "bg-home": (0, 0, 0, 0.13),     # 左下印章
    "bg-me": (0, 0.13, 0.03, 0),    # 右上印章
    "mode-daily": (0, 0, 0.10, 0.15),  # 右下印章
}

def load(name):
    im = Image.open(f"raw/{name}.jpg").convert("RGB")
    l, t, r, b = CROP.get(name, (0, 0, 0, 0))
    w, h = im.size
    return im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))

def bbox_of(im, thr):
    g = ImageOps.grayscale(im).point(lambda v: 255 if v > thr else 0).filter(ImageFilter.MaxFilter(5))
    return g.getbbox() or (0, 0, im.width, im.height)

def feather_circle(size, r_in, r_out):
    m = Image.new("L", (size, size), 0)
    c = size / 2
    ImageDraw.Draw(m).ellipse((c - r_out, c - r_out, c + r_out, c + r_out), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(max(1, (r_out - r_in) / 2)))
    inner = Image.new("L", (size, size), 0)
    ImageDraw.Draw(inner).ellipse((c - r_in, c - r_in, c + r_in, c + r_in), fill=255)
    return ImageChops.lighter(m, inner)

def coin(name, px):
    im = load(name)
    x0, y0, x1, y1 = bbox_of(im, 30)
    s = min(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = int(s / 2 + 6)
    l, t = int(cx - half), int(cy - half)
    sq = im.crop((l, t, l + 2 * half, t + 2 * half))
    r = s / 2 * 0.985
    sq.putalpha(feather_circle(sq.width, r - 3, r))
    sq.resize((px, px), Image.LANCZOS).save(f"{OUT}/{name}.webp", "WEBP", quality=88, method=6)

def medallion(name, px):
    im = load(name)
    x0, y0, x1, y1 = bbox_of(im, 26)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = int(max(x1 - x0, y1 - y0) * 1.08)
    half = s // 2
    canvas = Image.new("RGB", (s, s), (0, 0, 0))
    l, t = int(cx - half), int(cy - half)
    canvas.paste(im.crop((l, t, l + s, t + s)), (0, 0))
    canvas.putalpha(feather_circle(s, s * 0.38, s * 0.5))
    canvas.resize((px, px), Image.LANCZOS).save(f"{OUT}/{name}.webp", "WEBP", quality=86, method=6)

def photo(name, w, h, q=72):
    ImageOps.fit(load(name), (w, h), Image.LANCZOS).save(f"{OUT}/{name}.webp", "WEBP", quality=q, method=6)

coin("logo", 256)
for i in range(10):
    coin(f"rank-{i}", 256)
for n in sorted(os.listdir("raw")):
    n = n[:-4]
    if n.startswith("stone-") or n.startswith("foe-"):
        medallion(n, 256)
    elif n.startswith("map-") or n.startswith("bg-"):
        photo(n, 720, 1080)
    elif n.startswith("mode-"):
        photo(n, 720, 360, q=76)
print("ok")
