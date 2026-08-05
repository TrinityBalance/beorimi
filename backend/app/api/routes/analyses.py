"""POST /api/analyses (접수) · GET /api/analyses/{id} (상태 조회).

접수는 즉시 202 를 돌려주고 실제 분석은 워커가 한다. 클라이언트는 GET 을 반복 호출해
status 가 completed 또는 failed 가 될 때까지 기다린다.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import get_analysis_service
from ...schemas.analysis import AnalysisCreateRequest, AnalysisRecord
from ...services.analysis_service import (
    AnalysisNotFoundError,
    AnalysisQuotaExceededError,
    AnalysisService,
)
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
    except AnalysisQuotaExceededError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
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
