#!/usr/bin/env python3 -I
"""python3 -I sheet.py out.jpg scale crop_top crop_bottom label=img ... (crops y band at 1080-scale)"""
import sys
from PIL import Image, ImageDraw
out, scale, ct, cb = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
items = [a.split("=", 1) for a in sys.argv[5:]]
ims = []
for lab, p in items:
    im = Image.open(p).convert("RGB")
    if im.height != 1920: s = 1920 / im.height; im = im.resize((int(im.width * s), 1920), Image.LANCZOS)
    im = im.crop((0, ct, 1080, cb)).resize((int(1080 * scale), int((cb - ct) * scale)), Image.LANCZOS)
    ims.append((lab, im))
cols = int(__import__("os").environ.get("COLS", len(ims)))
rows = (len(ims) + cols - 1) // cols
w, h = ims[0][1].size
sheet = Image.new("RGB", (cols * (w + 6), rows * (h + 22)), (20, 20, 24))
d = ImageDraw.Draw(sheet)
for i, (lab, im) in enumerate(ims):
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 20)); d.text((x + 4, y + 4), lab, fill=(255, 255, 255))
sheet.save(out, quality=88)
