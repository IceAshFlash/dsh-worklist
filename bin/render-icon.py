"""把用户那张透明底的清单卡，衬到一个有明显对比的圆角底板上，让它在 16~48px 也能认出来。

用法：python bin/render-icon.py
输入：icon/icon.png（1024×1024，透明底，用户原图排版）
输出：icon/icon.png / icon/icon-512.png / bin/icon.ico（会覆盖自身，所以先备份到 icon/icon-plain.png）
"""
from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAIN = os.path.join(ROOT, 'icon', 'icon-plain.png')   # 透明底原件（只存一次）
TARGET = os.path.join(ROOT, 'icon', 'icon.png')

if not os.path.exists(PLAIN):
    Image.open(TARGET).convert('RGBA').save(PLAIN)
art = Image.open(PLAIN).convert('RGBA')

SIZE = 1024
TOP = (63, 107, 230)      # #3F6BE6
BOTTOM = (42, 79, 191)    # #2A4FBF
radius = int(SIZE * 0.225)
SS = 4                    # 圆角用 4 倍超采样画

plate = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(plate)
grad = Image.new('RGBA', (1, SIZE))
for y in range(SIZE):
    t = y / (SIZE - 1)
    grad.putpixel((0, y), (int(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
                           int(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
                           int(TOP[2] + (BOTTOM[2] - TOP[2]) * t), 255))
grad = grad.resize((SIZE, SIZE))

mask = Image.new('L', (SIZE * SS, SIZE * SS), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [0, 0, SIZE * SS - 1, SIZE * SS - 1], radius=radius * SS, fill=255)
mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
plate.paste(grad, (0, 0), mask)

# 卡片：占 74% 高度，垂直居中略偏上，下方留一点空间做投影
h = int(SIZE * 0.74)
w = max(1, round(art.size[0] * h / art.size[1]))
card = art.resize((w, h), Image.LANCZOS)
x = (SIZE - w) // 2
y = (SIZE - h) // 2 - int(SIZE * 0.015)

shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
shadow.paste(card, (x, y + int(SIZE * 0.012)), card)
shadow = shadow.filter(ImageFilter.GaussianBlur(int(SIZE * 0.018)))
alpha = shadow.split()[3].point(lambda v: int(v * 0.45))
shadow.putalpha(alpha)

out = Image.alpha_composite(plate, shadow)
out = Image.alpha_composite(out, Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)))
card_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
card_layer.paste(card, (x, y), card)
out = Image.alpha_composite(out, card_layer)

out.save(TARGET)
out.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, 'icon', 'icon-512.png'))
out.save(os.path.join(ROOT, 'bin', 'icon.ico'),
         sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

for px in (16, 32, 48):
    small = out.resize((px, px), Image.LANCZOS)
    print('--- %dx%d ---' % (px, px))
    p = small.load()
    for r in range(px):
        print(''.join('#' if sum(p[c, r][:3]) / 3 > 200 else
                      ('+' if sum(p[c, r][:3]) / 3 > 120 else '.') for c in range(px)))
print('icon.png / icon-512.png / bin/icon.ico 已更新')