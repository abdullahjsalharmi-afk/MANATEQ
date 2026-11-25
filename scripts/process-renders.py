"""Prepares building renders for the app.

  python3 scripts/process-renders.py <folder with source PNGs> [src/assets/renders]

Each source is a large PNG with a transparent background (the originals are not kept in this repository).
The script trims the empty margin, leaves a little air, scales to the display width and writes WebP with alpha,
then prints the size table used by src/design/Render/renders.ts. Needs Pillow."""
import sys, os, glob
from PIL import Image

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "src/assets/renders"
os.makedirs(out, exist_ok=True)
WIDE = {"journey": 2200}
total = 0
for path in sorted(glob.glob(os.path.join(src, "*.png"))):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert("RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(box)
    pad = round(im.width * 0.02)
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.alpha_composite(im, (pad, pad))
    width = WIDE.get(name, 1400)
    height = round(canvas.height * width / canvas.width)
    canvas = canvas.resize((width, height), Image.LANCZOS)
    dest = os.path.join(out, name + ".webp")
    canvas.save(dest, "WEBP", quality=82, alpha_quality=92, method=6)
    size = os.path.getsize(dest)
    total += size
    print(f"  {name}: {{ width: {width}, height: {height} }},  // {size // 1024} KB")
print(f"total {total // 1024} KB")
