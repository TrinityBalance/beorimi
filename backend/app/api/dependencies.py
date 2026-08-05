"""의존성 조립(DI).

라우트 함수는 `Depends(get_upload_service)` 처럼 "무엇이 필요한지"만 선언하고,
그 부품을 실제로 만드는 방법은 이 파일에만 둔다. 테스트는 이 함수들을 가짜로
바꿔치기(`dependency_overrides`)해서 AWS 없이 돌린다.
"""

from functools import lru_cache

import boto3
from botocore.config import Config

from ..core.config import Settings, settings
from ..repositories.analysis_repository import AnalysisRepository
from ..services.analysis_service import AnalysisService
from ..services.upload_service import UploadService
from ..services.vlm_client import VlmClient


def get_settings() -> Settings:
    return settings


def get_vlm_client() -> VlmClient:
    return VlmClient(
        settings.vlm_base_url,
        settings.vlm_service_token,
        settings.vlm_timeout_seconds,
    )


# AIDEV-NOTE: lru_cache 로 boto3 클라이언트를 재사용한다. 생성 비용이 커서 요청마다 만들면
#             Lambda 응답이 눈에 띄게 느려진다(웜 컨테이너에서 재사용됨).
@lru_cache
def get_s3_client():
    # AIDEV-NOTE: Explicit SigV4 keeps presigned URLs on the regional host; the default can redirect new Seoul buckets.
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"},
        ),
    )


@lru_cache
def get_dynamodb_resource():
    return boto3.resource("dynamodb", region_name=settings.aws_region)


@lru_cache
def get_sqs_client():
    return boto3.client("sqs", region_name=settings.aws_region)


def get_upload_service() -> UploadService:
    return UploadService(
        s3_client=get_s3_client(),
        bucket_name=settings.image_bucket_name,
        expires_in=settings.presigned_url_ttl_seconds,
        max_bytes=settings.max_source_image_bytes,
    )


def get_analysis_repository() -> AnalysisRepository:
    return AnalysisRepository(
        get_dynamodb_resource().Table(settings.analysis_table_name)
    )


def get_analysis_service() -> AnalysisService:
    return AnalysisService(
        upload_service=get_upload_service(),
        repository=get_analysis_repository(),
        sqs_client=get_sqs_client(),
        queue_url=settings.analysis_queue_url,
        retention_days=settings.analysis_retention_days,
    )
