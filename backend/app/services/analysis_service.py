import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from ..repositories.analysis_repository import AnalysisRepository
from .upload_service import UploadService


class AnalysisNotFoundError(LookupError):
    pass


class AnalysisService:
    def __init__(
        self,
        upload_service: UploadService,
        repository: AnalysisRepository,
        sqs_client: Any,
        queue_url: str,
        retention_days: int,
    ) -> None:
        self._upload_service = upload_service
        self._repository = repository
        self._sqs = sqs_client
        self._queue_url = queue_url
        self._retention_days = retention_days

    def create(self, owner: str, image_key: str) -> dict[str, Any]:
        if not self._queue_url:
            raise RuntimeError("ANALYSIS_QUEUE_URL is not configured")
        self._upload_service.verify_uploaded_object(owner, image_key)
        now = datetime.now(UTC)
        analysis_id = str(uuid4())
        record = {
            "id": analysis_id,
            "owner": owner,
            "image_key": image_key,
            "status": "queued",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "expires_at": int(
                (now + timedelta(days=self._retention_days)).timestamp()
            ),
        }
        self._repository.create(record)
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
            self._repository.mark_failed(
                analysis_id,
                datetime.now(UTC).isoformat(),
                "Analysis queue is unavailable",
            )
            raise
        return record

    def get_for_owner(self, owner: str, analysis_id: str) -> dict[str, Any]:
        record = self._repository.get(analysis_id)
        if record is None or record.get("owner") != owner:
            raise AnalysisNotFoundError("Analysis was not found")
        return record
