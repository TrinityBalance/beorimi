from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..dependencies import get_settings, get_vlm_client
from ...core.config import Settings
from ...services.vlm_client import (
    VlmClient,
    VlmConfigurationError,
    VlmConnectionError,
    VlmGuardrailError,
    VlmResponseError,
    VlmTimeoutError,
)

router = APIRouter()
READ_CHUNK_BYTES = 1024 * 1024
PASSTHROUGH_VLM_STATUS_CODES = {400, 413, 415}


async def _read_limited_upload(file: UploadFile, limit: int) -> bytes:
    contents = bytearray()
    while chunk := await file.read(READ_CHUNK_BYTES):
        if len(contents) + len(chunk) > limit:
            raise HTTPException(status_code=413, detail="Image file is too large")
        contents.extend(chunk)
    return bytes(contents)


@router.post("/analysis")
async def analyze_waste(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    vlm_client: VlmClient = Depends(get_vlm_client),
) -> dict:
    contents = await _read_limited_upload(file, settings.max_upload_bytes)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        return await vlm_client.analyze(
            filename=file.filename or "upload.jpg",
            content=contents,
            content_type=file.content_type or "application/octet-stream",
        )
    except VlmConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except VlmTimeoutError as error:
        raise HTTPException(status_code=504, detail="VLM request timed out") from error
    except VlmConnectionError as error:
        raise HTTPException(status_code=502, detail="VLM service is unreachable") from error
    except VlmGuardrailError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except VlmResponseError as error:
        if error.status_code in PASSTHROUGH_VLM_STATUS_CODES:
            raise HTTPException(
                status_code=error.status_code,
                detail=error.detail,
            ) from error
        if error.status_code == 503:
            raise HTTPException(
                status_code=503,
                detail="VLM service is unavailable",
            ) from error
        raise HTTPException(status_code=502, detail="VLM request failed") from error
