"""Generate the extension's small geometric icon; Pillow is a build-only dependency."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / 'extension' / 'icons'
root.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, 504, 504), radius=128, fill='#152337')
    draw.polygon([(130, 128), (130, 384), (306, 256)], fill='#83e4c1')
    draw.polygon([(302, 170), (302, 342), (414, 256)], fill='#f4fbff')
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / f'icon{size}.png')
