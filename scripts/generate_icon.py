from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/msyhbd.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: tuple[int, int, int, int]) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_icon(size: int = 1024) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)

    margin = int(size * 0.085)
    box = (margin, margin, size - margin, size - margin)
    radius = int(size * 0.19)

    glow_draw.rounded_rectangle(box, radius=radius, outline=(33, 214, 231, 190), width=int(size * 0.035))
    glow = glow.filter(ImageFilter.GaussianBlur(int(size * 0.045)))
    image.alpha_composite(glow)

    draw = ImageDraw.Draw(image)
    rounded_rect(draw, box, radius, (13, 16, 32, 255))
    draw.rounded_rectangle(box, radius=radius, outline=(80, 140, 255, 190), width=int(size * 0.012))

    inner = int(size * 0.22)
    draw.ellipse(
        (inner, inner, size - inner, size - inner),
        outline=(33, 214, 231, 230),
        width=int(size * 0.024),
    )
    draw.arc(
        (inner + 34, inner + 34, size - inner - 34, size - inner - 34),
        start=215,
        end=30,
        fill=(47, 224, 152, 255),
        width=int(size * 0.026),
    )

    font = load_font(int(size * 0.27))
    text = "QF"
    text_box = draw.textbbox((0, 0), text, font=font)
    text_w = text_box[2] - text_box[0]
    text_h = text_box[3] - text_box[1]
    x = (size - text_w) / 2
    y = (size - text_h) / 2 - int(size * 0.02)
    draw.text((x + 4, y + 5), text, font=font, fill=(0, 0, 0, 110))
    draw.text((x, y), text, font=font, fill=(237, 243, 255, 255))

    node_r = int(size * 0.026)
    for px, py, color in [
        (0.28, 0.3, (255, 196, 77, 255)),
        (0.72, 0.29, (124, 92, 255, 255)),
        (0.76, 0.68, (47, 224, 152, 255)),
        (0.24, 0.7, (33, 214, 231, 255)),
    ]:
        cx = int(size * px)
        cy = int(size * py)
        draw.ellipse((cx - node_r, cy - node_r, cx + node_r, cy + node_r), fill=color)

    return image


if __name__ == "__main__":
    icon = make_icon()
    png_path = ASSETS / "quantumflow-icon.png"
    ico_path = ASSETS / "quantumflow-icon.ico"
    icon.save(png_path)
    icon.save(ico_path, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(png_path)
    print(ico_path)
