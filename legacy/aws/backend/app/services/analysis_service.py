"""분석 요청의 접수와 조회.

요청을 받아 즉시 결과를 만들지 않고, DynamoDB 에 접수 기록을 남긴 뒤 SQS 로 넘긴다.
실제 분석은 `workers/analysis.py` 가 나중에 수행하고, 클라이언트는 `get_for_owner` 로
상태를 polling 한다.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from ..repositories.analysis_repository import (
    AnalysisQuotaLimitReachedError,
    AnalysisRepository,
)
from .upload_service import UploadService

logger = logging.getLogger(__name__)


class AnalysisNotFoundError(LookupError):
    pass


class AnalysisQuotaExceededError(RuntimeError):
    pass


class AnalysisService:
    def __init__(
        self,
        upload_service: UploadService,
        repository: AnalysisRepository,
        sqs_client: Any,
        queue_url: str,
        retention_days: int,
        account_limit: int = 5,
    ) -> None:
        self._upload_service = upload_service
        self._repository = repository
        self._sqs = sqs_client
        self._queue_url = queue_url
        self._retention_days = retention_days
        self._account_limit = account_limit

    def create(self, owner: str, image_key: str) -> dict[str, Any]:
        """분석을 접수하고 큐에 넣는다. 반환 시점의 상태는 항상 queued 다."""
        if not self._queue_url:
            raise RuntimeError("ANALYSIS_QUEUE_URL is not configured")
        self._upload_service.verify_uploaded_object(owner, image_key)
        try:
            self._repository.reserve_quota(owner, self._account_limit)
        except AnalysisQuotaLimitReachedError as error:
            raise AnalysisQuotaExceededError(
                f"Account analysis limit of {self._account_limit} has been reached"
            ) from error
        now = datetime.now(UTC)
        analysis_id = str(uuid4())
        record = {
            "id": analysis_id,
            "owner": owner,
            "image_key": image_key,
            "status": "queued",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            # AIDEV-NOTE: DynamoDB TTL 이 이 필드를 보고 자동 삭제한다. 이름과 epoch 초 형식은
            #             infra/backend-secure.yaml 의 TimeToLiveSpecification 과 맞춰야 한다.
            "expires_at": int(
                (now + timedelta(days=self._retention_days)).timestamp()
            ),
        }
        # AIDEV-NOTE: 순서 중요 — 기록을 먼저 남겨야 워커가 메시지를 받았을 때 조회할 행이 존재한다.
        #             반대로 하면 워커가 먼저 실행돼 없는 id 를 갱신할 수 있다.
        try:
            self._repository.create(record)
        except Exception:
            self._release_quota(owner)
            raise
        try:
            self._sqs.send_message(
                QueueUrl=self._queue_url,
                MessageBody=json.dumps(
                    {
                        "analysis_id": analysis_id,
                        "owner": owner,
                        "image_key": image_key,
                    }
                ),
            )
        except Exception:
            try:
                self._repository.mark_failed(
                    analysis_id,
                    datetime.now(UTC).isoformat(),
                    "Analysis queue is unavailable",
                )
            except Exception:
                logger.exception("Failed to persist analysis queue error")
            # AIDEV-NOTE: SQS 전송 timeout 뒤에도 메시지가 접수됐을 수 있다. 여기서 quota를
            #             되돌리면 실제 분석이 5회를 넘을 수 있으므로 비용 상한을 우선한다.
            raise
        return record

    def _release_quota(self, owner: str) -> None:
        try:
            self._repository.release_quota(owner)
        except Exception:
            logger.exception("Failed to release account analysis quota")

    def get_for_owner(self, owner: str, analysis_id: str) -> dict[str, Any]:
        """본인 것이 아니면 403 이 아니라 404 로 취급한다 — id 존재 여부를 흘리지 않기 위해서다."""
        record = self._repository.get(analysis_id)
        if (
            record is None
            or record.get("owner") != owner
            or record.get("record_type", "analysis") != "analysis"
        ):
            raise AnalysisNotFoundError("Analysis was not found")
        return record
