import sys, base64, subprocess, os, io, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30

def launch(p):
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome",
                          args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                                "--allow-file-access-from-files"])
    pg = b.new_page(viewport={"width": 1080, "height": 1920})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto("file://" + os.path.join(HERE, "film.html"))
    pg.wait_for_function("window.SHOTS_T !== undefined", timeout=20000)
    return b, pg, errs

def shot_of(shots, t):
    for i, (a, b) in enumerate(shots):
        if a <= t < b:
            return i
    return len(shots) - 1

mode = sys.argv[1]
with sync_playwright() as p:
    b, pg, errs = launch(p)
    shots = pg.evaluate("SHOTS_T")
    if mode == "preview":
        from PIL import Image
        ts = [float(x) for x in sys.argv[2].split(",")]
        name = sys.argv[3] if len(sys.argv) > 3 else "sheet"
        ims = []
        for t in ts:
            d = pg.evaluate(f"frame({shot_of(shots, t)},{t})")
            im = Image.open(io.BytesIO(base64.b64decode(d.split(",", 1)[1])))
            im.save(os.path.join(HERE, "prev", f"{t:06.2f}.jpg"))
            ims.append(im.resize((360, 640)))
        sheet = Image.new("RGB", (360 * len(ims), 640))
        for i, im in enumerate(ims):
            sheet.paste(im, (360 * i, 0))
        sheet.save(os.path.join(HERE, "prev", name + ".jpg"), quality=88)
        print("errors:", errs)
    else:
        which = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else list(range(len(shots)))
        os.makedirs(os.path.join(HERE, "shots"), exist_ok=True)
        for i in which:
            a, bb = shots[i]
            f0, f1 = round(a * FPS), round(bb * FPS)
            out = os.path.join(HERE, "shots", f"s{i:02d}.mp4")
            tmp = out[:-4] + ".part.mp4"
            hall = 17 <= i <= 21
            vf = "format=yuv420p" if not hall else "noise=alls=10:allf=t,format=yuv420p"
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                                   "-c:v", "mjpeg", "-i", "-", "-vf", vf, "-c:v", "libx264", "-crf", "17",
                                   "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", str(FPS), tmp], stdin=subprocess.PIPE)
            t0 = time.time()
            for f in range(f0, f1):
                d = pg.evaluate(f"frame({i},{f / FPS})")
                ff.stdin.write(base64.b64decode(d.split(",", 1)[1]))
            ff.stdin.close()
            rc = ff.wait()
            if rc == 0:
                os.replace(tmp, out)
            print(f"shot {i} frames {f1 - f0} rc {rc} {time.time() - t0:.1f}s", flush=True)
        print("errors:", errs)
    b.close()
