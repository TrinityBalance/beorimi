import argparse
import json
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from .inference import extract
from .postprocessing import render_overlay
from .preprocessing import IMAGE_DIR, SUPPORTED_IMAGE_SUFFIXES, resolve_image_paths

app = FastAPI(title="Beorimi VLM", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vlm"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    if suffix not in SUPPORTED_IMAGE_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported image format")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(contents)
            temporary_path = Path(temporary.name)
        return await run_in_threadpool(extract, temporary_path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


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
            image_path, use_cache=not args.no_cache, verbose=args.verbose
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.overlay:
            output = Path(args.output_dir) / f"{image_path.stem}_overlay.jpg"
            print(f"Overlay saved: {render_overlay(image_path, result, output)}")


if __name__ == "__main__":
    run_cli()
