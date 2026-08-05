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
