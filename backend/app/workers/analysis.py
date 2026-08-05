"""SQS 를 소비하는 분석 워커 Lambda.

API Lambda(`app.main.handler`)와 같은 배포 ZIP 을 공유하지만 진입점이 다르다.
API 는 요청을 큐에 넣고 즉시 202 를 돌려주고, 실제 VLM 호출은 여기서 일어난다.

재시도 계약이 이 파일의 핵심이다.
- 예외를 밖으로 던지면  → SQS 가 메시지를 다시 넣어 재시도한다(일시적 장애).
- mark_failed 후 return → 재시도하지 않고 실패로 확정한다(영구 실패).
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import boto3

from ..agents.graph import PROMPT_INJECTION_BLOCK_MESSAGE, evaluate_vlm_result
from ..core.config import settings
from ..repositories.analysis_repository import AnalysisRepository
from ..services.upload_service import (
    MISSING_OBJECT_ERROR_CODES,
    describe_object_problem,
    owner_key_prefix,
    s3_error_code,
)
from ..services.vlm_client import VlmClient, VlmResponseError

logger = logging.getLogger(__name__)
# AIDEV-NOTE: 이미지 자체가 잘못된 경우라 재시도해도 결과가 같다. 나머지 상태 코드는 일시적 장애로 보고 재시도한다.
PERMANENT_VLM_STATUS_CODES = {400, 413, 415}


class PermanentAnalysisError(ValueError):
    """재시도해도 결과가 달라지지 않는 실패."""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


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
    """S3 에서 원본 이미지를 읽어 (파일명, 바이트, Content-Type) 로 돌려준다.

    큐 메시지의 image_key 를 그대로 믿지 않고 소유권과 규격을 여기서 다시 검사한다.
    검증 규칙은 upload_service 의 공용 헬퍼를 쓴다.
    """
    if not bucket_name:
        raise RuntimeError("IMAGE_BUCKET_NAME is not configured")
    if not image_key.startswith(owner_key_prefix(owner)):
        raise PermanentAnalysisError("Image key does not belong to the user")

    try:
        response = s3_client.get_object(
            Bucket=bucket_name,
            Key=image_key,
        )
    except Exception as error:
        if s3_error_code(error) in MISSING_OBJECT_ERROR_CODES:
            raise PermanentAnalysisError("Uploaded image was not found") from error
        raise

    content_length = int(response.get("ContentLength", 0))
    content_type = str(response.get("ContentType", ""))
    problem = describe_object_problem(content_length, content_type, max_bytes)
    if problem is not None:
        raise PermanentAnalysisError(problem)

    body = response["Body"]
    try:
        # AIDEV-NOTE: max_bytes + 1 만큼 읽어 상한 초과를 감지한다. 아래 길이 비교가 그 확인이자
        #             메타데이터와 실제 본문이 어긋난 경우(덮어쓰기 등)를 잡는 장치다.
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
    """메시지 한 건을 처리한다. 예외를 던지면 SQS 가 재시도한다.

    인자로 의존성을 모두 받는 이유는 테스트에서 가짜 S3/VLM 을 끼워 넣기 위해서다.
    """
    payload = json.loads(record["body"])
    analysis_id = payload["analysis_id"]
    owner = payload["owner"]
    image_key = payload["image_key"]
    repository.mark_processing(analysis_id, _now_iso())

    try:
        filename, content, content_type = _read_source_image(
            s3_client,
            bucket_name,
            max_bytes,
            owner,
            image_key,
        )
        vlm_result = vlm_client.analyze_result_sync(filename, content, content_type)
    except PermanentAnalysisError as error:
        repository.mark_failed(analysis_id, _now_iso(), str(error))
        return
    except VlmResponseError as error:
        if error.status_code not in PERMANENT_VLM_STATUS_CODES:
            raise
        repository.mark_failed(
            analysis_id,
            _now_iso(),
            f"VLM rejected image: {error.detail}",
        )
        return

    guarded_state = evaluate_vlm_result(
        vlm_result["observation"],
        vlm_result["guardrail"],
    )
    if guarded_state["status"] == "blocked":
        repository.mark_failed(
            analysis_id,
            _now_iso(),
            PROMPT_INJECTION_BLOCK_MESSAGE,
        )
        return

    repository.mark_completed(
        analysis_id=analysis_id,
        updated_at=_now_iso(),
        observation=guarded_state["observation"],
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
    """Lambda 진입점. 실패한 메시지만 골라 SQS 에 돌려준다.

    batchItemFailures 를 반환하려면 EventSourceMapping 에 ReportBatchItemFailures 가
    켜져 있어야 한다(infra/backend-secure.yaml).
    """
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
            # AIDEV-NOTE: ANALYSIS_MAX_RECEIVE_COUNT 는 SQS RedrivePolicy 의 maxReceiveCount 와
            #             같아야 한다(infra/backend-secure.yaml). 크면 DLQ 로 먼저 빠져 상태가
            #             queued 로 남고, 작으면 재시도가 남았는데 failed 로 확정된다.
            if analysis_id and _receive_count(record) >= settings.analysis_max_receive_count:
                try:
                    repository.mark_failed(
                        analysis_id,
                        _now_iso(),
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
