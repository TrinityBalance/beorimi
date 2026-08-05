from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        Path("C:/Windows/Fonts/malgun.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ):
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def render_overlay(
    image_path: str | Path, result: dict, output_path: str | Path
) -> Path:
    image = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    font = _load_font(max(18, width // 38))
    colors = ["#00E5FF", "#FFEA00", "#FF4081", "#69F0AE", "#B388FF"]

    for index, item in enumerate(result.get("items", [])):
        bbox = item.get("bbox")
        if not bbox:
            continue

        left, top, right, bottom = bbox
        x1, y1 = left * width / 1000, top * height / 1000
        x2, y2 = right * width / 1000, bottom * height / 1000
        color = colors[index % len(colors)]
        draw.rectangle(
            (x1, y1, x2, y2), outline=color, width=max(3, width // 250)
        )
        size = item.get("estimated_longest_side_cm")
        size_text = f"약 {size}cm" if size is not None else "크기 확인 필요"
        label = (
            f"{item['id']}. {item['label']} · {size_text} · "
            f"{item['confidence']:.0%}"
        )
        text_box = draw.textbbox((x1, y1), label, font=font)
        label_top = max(0, y1 - (text_box[3] - text_box[1] + 10))
        draw.rounded_rectangle(
            (x1, label_top, text_box[2] + 10, y1), radius=5, fill=color
        )
        draw.text((x1 + 5, label_top + 3), label, fill="black", font=font)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=95)
    return output
