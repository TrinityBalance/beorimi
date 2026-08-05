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
