"""DynamoDB 분석 테이블 접근.

DynamoDB 문법(UpdateExpression, 예약어 회피, Decimal 변환)을 이 파일 안에만 가둔다.
윗 계층은 mark_completed 같은 이름만 알면 되고, 나중에 저장소를 바꿔도 여기만 고치면 된다.
"""

import json
from decimal import Decimal
from typing import Any


class AnalysisRepository:
    def __init__(self, table: Any) -> None:
        self._table = table

    def create(self, record: dict[str, Any]) -> dict[str, Any]:
        # AIDEV-NOTE: ConditionExpression 이 없으면 put_item 은 같은 id 를 조용히 덮어쓴다.
        #             기존 분석을 지우지 않도록 신규일 때만 쓰게 막는다.
        self._table.put_item(
            Item=record,
            ConditionExpression="attribute_not_exists(id)",
        )
        return record

    def get(self, analysis_id: str) -> dict[str, Any] | None:
        # AIDEV-NOTE: ConsistentRead 필수 — 기본 읽기는 지연 복제라 방금 완료된 분석이
        #             polling 응답에서 아직 queued 로 보일 수 있다.
        response = self._table.get_item(
            Key={"id": analysis_id},
            ConsistentRead=True,
        )
        return response.get("Item")

    def mark_processing(self, analysis_id: str, updated_at: str) -> None:
        # AIDEV-NOTE: status 는 DynamoDB 예약어라 식에 직접 못 쓴다. 아래 파일 전체가
        #             #status 별칭 + ExpressionAttributeNames 로 우회하는 이유다.
        self._table.update_item(
            Key={"id": analysis_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "processing",
                ":updated_at": updated_at,
            },
        )

    def mark_completed(
        self,
        analysis_id: str,
        updated_at: str,
        observation: dict[str, Any],
    ) -> None:
        self._table.update_item(
            Key={"id": analysis_id},
            UpdateExpression=(
                "SET #status = :status, updated_at = :updated_at, "
                "observation = :observation "
                "REMOVE error_message"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "completed",
                ":updated_at": updated_at,
                # AIDEV-NOTE: DynamoDB rejects float; JSON parsing converts only floats to Decimal.
                ":observation": json.loads(
                    json.dumps(observation),
                    parse_float=Decimal,
                ),
            },
        )

    def mark_failed(
        self, analysis_id: str, updated_at: str, error_message: str
    ) -> None:
        self._table.update_item(
            Key={"id": analysis_id},
            UpdateExpression=(
                "SET #status = :status, updated_at = :updated_at, "
                "error_message = :error_message"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "failed",
                ":updated_at": updated_at,
                ":error_message": error_message,
            },
        )
