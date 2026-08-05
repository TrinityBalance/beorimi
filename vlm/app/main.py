import argparse
import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .inference import extract
from .postprocessing import render_overlay
from .preprocessing import IMAGE_DIR, SUPPORTED_IMAGE_SUFFIXES, resolve_image_paths
from .providers.base import (
    ProviderConfigurationError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

app = FastAPI(title="Beorimi VLM", version="0.1.0")
MAX_UPLOAD_BYTES = int(os.getenv("VLM_MAX_UPLOAD_MB", "10")) * 1024 * 1024


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vlm"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    if suffix not in SUPPORTED_IMAGE_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported image format")

    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image file is too large")

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(contents)
            temporary_path = Path(temporary.name)
        try:
            return await run_in_threadpool(extract, temporary_path)
        except (UnidentifiedImageError, OSError) as error:
            raise HTTPException(status_code=400, detail="Invalid image file") from error
        except ProviderConfigurationError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except ProviderTimeoutError as error:
            raise HTTPException(status_code=504, detail=str(error)) from error
        except ProviderUnavailableError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except ProviderResponseError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
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
