"""요청·응답 스키마.

pydantic 이 라우트 함수 실행 *전에* 검사하므로, 형식이 어긋난 요청은 서비스 계층까지
내려오지 않고 422 로 끊긴다. 응답 모델은 DynamoDB 레코드에서 외부에 내보낼 필드만 고른다.
"""

from typing import Literal

from pydantic import BaseModel, Field


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    size_bytes: int = Field(gt=0)


class UploadUrlResponse(BaseModel):
    upload_url: str
    image_key: str
    expires_in: int
    form_fields: dict[str, str]


class AnalysisCreateRequest(BaseModel):
    image_key: str = Field(min_length=1, max_length=1024)


class AnalysisRecord(BaseModel):
    id: str
    owner: str
    image_key: str
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: str
    updated_at: str
    item_name: str | None = None
    fee: int | None = None
    message: str | None = None
    error_message: str | None = None
    observation: dict | None = None
