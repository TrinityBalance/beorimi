"""DynamoDB 분석 테이블 접근.

DynamoDB 문법(UpdateExpression, 예약어 회피, Decimal 변환)을 이 파일 안에만 가둔다.
윗 계층은 mark_completed 같은 이름만 알면 되고, 나중에 저장소를 바꿔도 여기만 고치면 된다.
"""

import json
from decimal import Decimal
from typing import Any

from botocore.exceptions import ClientError

QUOTA_ITEM_PREFIX = "analysis-quota#"


def _decode_dynamodb_numbers(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {key: _decode_dynamodb_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_dynamodb_numbers(item) for item in value]
    return value


class AnalysisQuotaLimitReachedError(RuntimeError):
    pass


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
        item = response.get("Item")
        if item is None:
            return None
        # AIDEV-NOTE: boto3 returns every DynamoDB number as Decimal, while the public
        #             response contract uses strict JSON ints/floats. Decode at the storage boundary.
        return _decode_dynamodb_numbers(item)

    def reserve_quota(self, owner: str, limit: int) -> None:
        # AIDEV-NOTE: owner is a DynamoDB reserved word and must stay behind #owner
        #             anywhere it appears in an expression.
        try:
            self._table.update_item(
                Key={"id": f"{QUOTA_ITEM_PREFIX}{owner}"},
                UpdateExpression=(
                    "SET record_type = if_not_exists(record_type, :record_type), "
                    "#owner = if_not_exists(#owner, :owner) "
                    "ADD analysis_count :one"
                ),
                ConditionExpression=(
                    "attribute_not_exists(analysis_count) OR analysis_count < :limit"
                ),
                ExpressionAttributeNames={"#owner": "owner"},
                ExpressionAttributeValues={
                    ":record_type": "analysis_quota",
                    ":owner": owner,
                    ":one": 1,
                    ":limit": limit,
                },
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == (
                "ConditionalCheckFailedException"
            ):
                raise AnalysisQuotaLimitReachedError from error
            raise

    def release_quota(self, owner: str) -> None:
        # AIDEV-NOTE: quota item에는 expires_at을 두지 않는다. 분석·이미지는 30일 후 지워져도
        #             계정별 MVP 5회 제한은 누적으로 유지해야 한다.
        self._table.update_item(
            Key={"id": f"{QUOTA_ITEM_PREFIX}{owner}"},
            UpdateExpression="ADD analysis_count :minus_one",
            ConditionExpression="analysis_count >= :one",
            ExpressionAttributeValues={":minus_one": -1, ":one": 1},
        )

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
