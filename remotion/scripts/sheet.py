# python3 scripts/sheet.py outDir sheet.jpg [cols=4] : contact sheet of f*.jpg with frame/time labels
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
fs = sorted(glob.glob(os.path.join(d, "f*.jpg")))
ims = [Image.open(f) for f in fs]; w, h = ims[0].size
tw, th = 270, int(270 * h / w)
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * tw, rows * (th + 28)), "#111")
dr = ImageDraw.Draw(S)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
except Exception: font = ImageFont.load_default()
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * tw, (i // cols) * (th + 28)
    S.paste(im.resize((tw, th)), (x, y + 28))
    fr = int(os.path.basename(f)[1:5]); dr.text((x + 6, y + 4), f"f{fr}  {fr/30:.2f}s", fill="#ffd166", font=font)
S.save(out, quality=88); print(out, S.size)
