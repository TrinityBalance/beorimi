import json
from decimal import Decimal
from typing import Any


class AnalysisRepository:
    def __init__(self, table: Any) -> None:
        self._table = table

    def create(self, record: dict[str, Any]) -> dict[str, Any]:
        self._table.put_item(
            Item=record,
            ConditionExpression="attribute_not_exists(id)",
        )
        return record

    def get(self, analysis_id: str) -> dict[str, Any] | None:
        response = self._table.get_item(
            Key={"id": analysis_id},
            ConsistentRead=True,
        )
        return response.get("Item")

    def mark_processing(self, analysis_id: str, updated_at: str) -> None:
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
