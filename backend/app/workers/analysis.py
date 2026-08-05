import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3

from ..core.config import settings
from ..repositories.analysis_repository import AnalysisRepository
from ..services.upload_service import CONTENT_TYPE_EXTENSIONS
from ..services.vlm_client import VlmClient, VlmResponseError

logger = logging.getLogger(__name__)
PERMANENT_VLM_STATUS_CODES = {400, 413, 415}


class PermanentAnalysisError(ValueError):
    pass


def _repository() -> AnalysisRepository:
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return AnalysisRepository(dynamodb.Table(settings.analysis_table_name))


def _s3_client():
    return boto3.client("s3", region_name=settings.aws_region)


def _vlm_client() -> VlmClient:
    return VlmClient(
        settings.vlm_base_url,
        settings.vlm_service_token,
        settings.vlm_timeout_seconds,
    )


def _read_source_image(
    s3_client: Any,
    bucket_name: str,
    max_bytes: int,
    owner: str,
    image_key: str,
) -> tuple[str, bytes, str]:
    if not bucket_name:
        raise RuntimeError("IMAGE_BUCKET_NAME is not configured")
    if not image_key.startswith(f"waste-images/{owner}/"):
        raise PermanentAnalysisError("Image key does not belong to the user")

    try:
        response = s3_client.get_object(
            Bucket=bucket_name,
            Key=image_key,
        )
    except Exception as error:
        code = str(getattr(error, "response", {}).get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NotFound"}:
            raise PermanentAnalysisError("Uploaded image was not found") from error
        raise

    content_length = int(response.get("ContentLength", 0))
    content_type = str(response.get("ContentType", ""))
    if content_length <= 0 or content_length > max_bytes:
        raise PermanentAnalysisError("Uploaded image size is invalid")
    if content_type not in CONTENT_TYPE_EXTENSIONS:
        raise PermanentAnalysisError("Uploaded image type is not supported")

    body = response["Body"]
    try:
        content = body.read(max_bytes + 1)
    finally:
        body.close()
    if len(content) != content_length:
        raise PermanentAnalysisError("Uploaded image content length changed")
    return Path(image_key).name, content, content_type


def process_record(
    record: dict[str, Any],
    repository: AnalysisRepository,
    s3_client: Any,
    vlm_client: VlmClient,
    bucket_name: str,
    max_bytes: int,
) -> None:
    payload = json.loads(record["body"])
    analysis_id = payload["analysis_id"]
    owner = payload["owner"]
    image_key = payload["image_key"]
    repository.mark_processing(analysis_id, datetime.now(UTC).isoformat())

    try:
        filename, content, content_type = _read_source_image(
            s3_client,
            bucket_name,
            max_bytes,
            owner,
            image_key,
        )
        observation = vlm_client.analyze_sync(filename, content, content_type)
    except PermanentAnalysisError as error:
        repository.mark_failed(
            analysis_id,
            datetime.now(UTC).isoformat(),
            str(error),
        )
        return
    except VlmResponseError as error:
        if error.status_code not in PERMANENT_VLM_STATUS_CODES:
            raise
        repository.mark_failed(
            analysis_id,
            datetime.now(UTC).isoformat(),
            f"VLM rejected image: {error.detail}",
        )
        return

    repository.mark_completed(
        analysis_id=analysis_id,
        updated_at=datetime.now(UTC).isoformat(),
        observation=observation,
    )


def _receive_count(record: dict[str, Any]) -> int:
    raw = record.get("attributes", {}).get("ApproximateReceiveCount", "1")
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 1


def _analysis_id(record: dict[str, Any]) -> str:
    try:
        return str(json.loads(record["body"])["analysis_id"])
    except (KeyError, TypeError, ValueError):
        return ""


def handler(event: dict[str, Any], context: Any) -> dict[str, list[dict[str, str]]]:
    del context
    repository = _repository()
    s3_client = _s3_client()
    vlm_client = _vlm_client()
    failures: list[dict[str, str]] = []
    for record in event.get("Records", []):
        try:
            process_record(
                record,
                repository,
                s3_client,
                vlm_client,
                settings.image_bucket_name,
                settings.max_source_image_bytes,
            )
        except Exception as error:
            message_id = str(record.get("messageId", ""))
            analysis_id = _analysis_id(record)
            logger.exception(
                "Analysis worker attempt failed",
                extra={"analysis_id": analysis_id, "message_id": message_id},
            )
            if analysis_id and _receive_count(record) >= settings.analysis_max_receive_count:
                try:
                    repository.mark_failed(
                        analysis_id,
                        datetime.now(UTC).isoformat(),
                        "Analysis failed after retry limit",
                    )
                except Exception:
                    logger.exception(
                        "Failed to persist terminal analysis error",
                        extra={"analysis_id": analysis_id},
                    )
            if message_id:
                failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}
