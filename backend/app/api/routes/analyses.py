from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import get_analysis_service
from ...schemas.aws_analysis import AnalysisCreateRequest, AnalysisRecord
from ...services.analysis_service import AnalysisNotFoundError, AnalysisService
from ...services.upload_service import (
    UploadedObjectNotFoundError,
    UploadValidationError,
)

router = APIRouter()


@router.post(
    "/analyses",
    response_model=AnalysisRecord,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_analysis(
    payload: AnalysisCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> dict:
    try:
        return analysis_service.create(user.sub, payload.image_key)
    except UploadValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except UploadedObjectNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/analyses/{analysis_id}", response_model=AnalysisRecord)
def get_analysis(
    analysis_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> dict:
    try:
        return analysis_service.get_for_owner(user.sub, analysis_id)
    except AnalysisNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
