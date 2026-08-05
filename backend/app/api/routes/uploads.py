"""POST /api/uploads — 업로드 자리 발급.

라우트는 HTTP 껍데기다. 검증과 발급은 UploadService 가 하고, 여기서는 서비스 예외를
상태 코드로만 옮긴다.
"""

from fastapi import APIRouter, Depends, HTTPException

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import get_upload_service
from ...schemas.aws_analysis import UploadUrlRequest, UploadUrlResponse
from ...services.upload_service import UploadService, UploadValidationError

router = APIRouter()


@router.post("/uploads", response_model=UploadUrlResponse)
def create_upload_url(
    payload: UploadUrlRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    upload_service: UploadService = Depends(get_upload_service),
) -> dict:
    try:
        return upload_service.create_upload_url(
            owner=user.sub,
            filename=payload.filename,
            content_type=payload.content_type,
            size_bytes=payload.size_bytes,
        )
    except UploadValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
