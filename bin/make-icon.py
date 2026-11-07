"""把 icon/icon.png 转成 Windows 用的多尺寸 bin/icon.ico。

图标母版是 icon/icon.png（1024×1024，从设计稿里裁出的清单卡 + 绿色圆角底）。
以后换了母版，跑一次这个脚本就行：

    python bin/make-icon.py

只依赖 Pillow；没有 Pillow 时，直接用 Photoshop / 在线工具导一个 ico 放到
bin/icon.ico 也可以，尺寸建议 16/24/32/48/64/128/256。
"""

from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    raise SystemExit('需要 Pillow：pip install pillow')

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'icon' / 'icon.png'
TARGET = ROOT / 'bin' / 'icon.ico'
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def main():
    if not SOURCE.exists():
        raise SystemExit(f'找不到母版：{SOURCE}')
    image = Image.open(SOURCE).convert('RGBA')
    if image.size != (1024, 1024):
        image = image.resize((1024, 1024), Image.LANCZOS)
        image.save(SOURCE)
    image.save(TARGET, sizes=SIZES)
    print(f'{TARGET} <- {SOURCE}（{len(SIZES)} 个尺寸）')


if __name__ == '__main__':
    main()