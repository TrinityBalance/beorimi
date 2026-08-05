import argparse
import json
from pathlib import Path

from .inference import extract
from .postprocessing import render_overlay
from .preprocessing import IMAGE_DIR, resolve_image_paths


def run_cli() -> None:
    parser = argparse.ArgumentParser(description="VLM image extraction")
    parser.add_argument(
        "images",
        nargs="*",
        help=f"image files or directories (default: {IMAGE_DIR})",
    )
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--overlay", action="store_true")
    parser.add_argument("--output-dir", default="vlm/vlm_overlays")
    args = parser.parse_args()

    try:
        image_paths = resolve_image_paths(args.images)
    except (FileNotFoundError, NotADirectoryError, RuntimeError, ValueError) as error:
        parser.error(str(error))

    for image_path in image_paths:
        print(f"\n=== {image_path} ===")
        result = extract(
            image_path,
            use_cache=not args.no_cache,
            verbose=args.verbose,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.overlay:
            output = Path(args.output_dir) / f"{image_path.stem}_overlay.jpg"
            print(f"Overlay saved: {render_overlay(image_path, result, output)}")
