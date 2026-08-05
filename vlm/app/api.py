import hmac
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from jsonschema.exceptions import ValidationError
from PIL import UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .config import VlmSettings, get_settings
from .contracts import to_vlm_response
from .inference import extract
from .preprocessing import SUPPORTED_IMAGE_SUFFIXES
from .providers.base import (
    ProviderConfigurationError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

app = FastAPI(title="Beorimi VLM", version="0.1.0")
SERVICE_TOKEN_HEADER = "X-Beorimi-Service-Token"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vlm"}


def require_service_token(
    service_token: str | None = Header(default=None, alias=SERVICE_TOKEN_HEADER),
    settings: VlmSettings = Depends(get_settings),
) -> None:
    if not settings.service_token:
        raise HTTPException(
            status_code=503,
            detail="VLM service token is not configured",
        )
    if service_token is None or not hmac.compare_digest(
        service_token,
        settings.service_token,
    ):
        raise HTTPException(status_code=401, detail="Invalid service token")


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    settings: VlmSettings = Depends(get_settings),
    _: None = Depends(require_service_token),
) -> dict:
    suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    if suffix not in SUPPORTED_IMAGE_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported image format")

    contents = await file.read(settings.max_upload_bytes + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image file is too large")

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(contents)
            temporary_path = Path(temporary.name)
        try:
            observation = await run_in_threadpool(extract, temporary_path)
            return to_vlm_response(observation)
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
        except ValidationError as error:
            raise HTTPException(
                status_code=502,
                detail="VLM observation did not match the internal schema",
            ) from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
