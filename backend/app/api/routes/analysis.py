from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..dependencies import get_vlm_client
from ...services.vlm_client import VlmClient

router = APIRouter()


@router.post("/analysis")
async def analyze_waste(
    file: UploadFile = File(...),
    vlm_client: VlmClient = Depends(get_vlm_client),
) -> dict:
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    return await vlm_client.analyze(
        filename=file.filename or "upload.jpg",
        content=contents,
        content_type=file.content_type or "application/octet-stream",
    )
