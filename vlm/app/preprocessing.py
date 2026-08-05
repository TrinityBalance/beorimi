import base64
import hashlib
import io
import os
from pathlib import Path
from typing import Sequence

from PIL import Image

VLM_ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = Path(
    os.getenv("VLM_IMAGE_DIR", str(VLM_ROOT / "data" / "photos"))
)
MAX_EDGE = 1024
SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def prepare_image(path: str | Path) -> tuple[str, str]:
    image = Image.open(path)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    width, height = image.size
    if max(width, height) > MAX_EDGE:
        scale = MAX_EDGE / max(width, height)
        image = image.resize(
            (int(width * scale), int(height * scale)), Image.Resampling.LANCZOS
        )

    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=85)
    raw = buffer.getvalue()
    return base64.b64encode(raw).decode(), hashlib.sha1(raw).hexdigest()


def images_in_directory(directory: str | Path) -> list[Path]:
    directory = Path(directory)
    if not directory.exists():
        raise FileNotFoundError(f"Image directory not found: {directory}")
    if not directory.is_dir():
        raise NotADirectoryError(f"Image path is not a directory: {directory}")

    images = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_SUFFIXES
    )
    if not images:
        extensions = ", ".join(sorted(SUPPORTED_IMAGE_SUFFIXES))
        raise RuntimeError(
            f"No images found in {directory}. Supported extensions: {extensions}"
        )
    return images


def resolve_image_paths(
    paths: Sequence[str | Path], default_directory: Path = IMAGE_DIR
) -> list[Path]:
    if not paths:
        return images_in_directory(default_directory)

    images: list[Path] = []
    for value in paths:
        path = Path(value)
        if path.is_dir():
            images.extend(images_in_directory(path))
        elif path.is_file():
            if path.suffix.lower() not in SUPPORTED_IMAGE_SUFFIXES:
                raise ValueError(f"Unsupported image format: {path}")
            images.append(path)
        else:
            raise FileNotFoundError(f"Image path not found: {path}")
    return images
