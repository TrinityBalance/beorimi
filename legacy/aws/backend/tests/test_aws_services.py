import json
from decimal import Decimal
from io import BytesIO
import unittest

from botocore.exceptions import ClientError

from backend.app.repositories.analysis_repository import (
    AnalysisQuotaLimitReachedError,
    AnalysisRepository,
)
from backend.app.services.analysis_service import (
    AnalysisNotFoundError,
    AnalysisQuotaExceededError,
    AnalysisService,
)
from backend.app.services.upload_service import UploadService, UploadValidationError
from backend.app.services.vlm_client import VlmResponseError
from backend.app.workers.analysis import process_record


class FakeS3:
    def __init__(self) -> None:
        self.head_response = {
            "ContentLength": 100,
            "ContentType": "image/jpeg",
        }
        self.post_request = None

    def generate_presigned_post(self, **kwargs):
        self.post_request = kwargs
        return {
            "url": "https://upload.example.invalid",
            "fields": {
                "key": kwargs["Key"],
                "Content-Type": kwargs["Fields"]["Content-Type"],
            },
        }

    def head_object(self, Bucket, Key):
        return self.head_response

    def get_object(self, Bucket, Key):
        return {
            **self.head_response,
            "Body": BytesIO(b"x" * self.head_response["ContentLength"]),
        }


class FakeRepository:
    def __init__(self, create_error=None) -> None:
        self.records = {}
        self.processing = []
        self.completed = []
        self.failed = []
        self.quota = {}
        self.create_error = create_error

    def create(self, record):
        if self.create_error:
            raise self.create_error
        self.records[record["id"]] = record
        return record

    def get(self, analysis_id):
        return self.records.get(analysis_id)

    def reserve_quota(self, owner, limit):
        used = self.quota.get(owner, 0)
        if used >= limit:
            raise AnalysisQuotaLimitReachedError
        self.quota[owner] = used + 1

    def release_quota(self, owner):
        self.quota[owner] -= 1

    def mark_processing(self, analysis_id, updated_at):
        self.processing.append((analysis_id, updated_at))

    def mark_completed(self, analysis_id, updated_at, observation):
        self.completed.append((analysis_id, updated_at, observation))

    def mark_failed(self, analysis_id, updated_at, error_message):
        self.failed.append((analysis_id, updated_at, error_message))


class FakeSqs:
    def __init__(self, error=None) -> None:
        self.messages = []
        self.error = error

    def send_message(self, **kwargs):
        if self.error:
            raise self.error
        self.messages.append(kwargs)


class FakeTable:
    def __init__(self, item=None) -> None:
        self.item = item
        self.update_request = None

    def get_item(self, **kwargs):
        if self.item is None:
            return {}
        return {"Item": self.item}

    def update_item(self, **kwargs):
        self.update_request = kwargs


class FakeQuotaTable:
    def __init__(self) -> None:
        self.counts = {}
        self.last_update_request = None

    def update_item(self, **kwargs):
        self.last_update_request = kwargs
        key = kwargs["Key"]["id"]
        values = kwargs["ExpressionAttributeValues"]
        count = self.counts.get(key, 0)
        if ":minus_one" in values:
            self.counts[key] = count + values[":minus_one"]
            return
        if count >= values[":limit"]:
            raise ClientError(
                {
                    "Error": {
                        "Code": "ConditionalCheckFailedException",
                        "Message": "limit reached",
                    }
                },
                "UpdateItem",
            )
        self.counts[key] = count + values[":one"]


class FakeVlmClient:
    def __init__(self, result=None, error=None, guardrail=None) -> None:
        self.observation = result or {
            "scene_type": "unclear",
            "items": [],
            "notes": "test",
        }
        self.error = error
        self.guardrail = guardrail or {
            "prompt_injection_detected": False,
            "risk_level": "none",
            "signals": [],
        }

    def analyze_result_sync(self, filename, content, content_type):
        if self.error:
            raise self.error
        return {
            "observation": self.observation,
            "guardrail": self.guardrail,
        }


class AwsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.s3 = FakeS3()
        self.uploads = UploadService(
            self.s3,
            bucket_name="images",
            expires_in=300,
            max_bytes=1024,
        )

    def test_upload_service_rejects_suffix_mismatch(self) -> None:
        with self.assertRaises(UploadValidationError):
            self.uploads.create_upload_url(
                "user-1", "waste.png", "image/jpeg", 100
            )

    def test_upload_form_enforces_content_type_and_size(self) -> None:
        result = self.uploads.create_upload_url(
            "user-1", "waste.jpg", "image/jpeg", 100
        )

        self.assertEqual(result["upload_url"], "https://upload.example.invalid")
        self.assertEqual(result["form_fields"]["Content-Type"], "image/jpeg")
        self.assertIn(
            ["content-length-range", 1, 1024],
            self.s3.post_request["Conditions"],
        )

    def test_analysis_service_rejects_another_users_key(self) -> None:
        service = AnalysisService(
            self.uploads, FakeRepository(), FakeSqs(), "queue-url", 30
        )

        with self.assertRaises(UploadValidationError):
            service.create("user-1", "waste-images/user-2/image.jpg")

    def test_analysis_service_persists_and_enqueues(self) -> None:
        repository = FakeRepository()
        sqs = FakeSqs()
        service = AnalysisService(
            self.uploads, repository, sqs, "queue-url", 30
        )

        result = service.create("user-1", "waste-images/user-1/image.jpg")

        self.assertEqual(result["status"], "queued")
        self.assertIn(result["id"], repository.records)
        message = json.loads(sqs.messages[0]["MessageBody"])
        self.assertEqual(message["analysis_id"], result["id"])
        self.assertEqual(message["owner"], "user-1")
        self.assertEqual(repository.quota["user-1"], 1)

    def test_analysis_service_limits_each_account_to_five_requests(self) -> None:
        repository = FakeRepository()
        sqs = FakeSqs()
        service = AnalysisService(
            self.uploads,
            repository,
            sqs,
            "queue-url",
            30,
            account_limit=5,
        )

        for _ in range(5):
            service.create("user-1", "waste-images/user-1/image.jpg")

        with self.assertRaises(AnalysisQuotaExceededError):
            service.create("user-1", "waste-images/user-1/image.jpg")
        service.create("user-2", "waste-images/user-2/image.jpg")

        self.assertEqual(repository.quota["user-1"], 5)
        self.assertEqual(repository.quota["user-2"], 1)
        self.assertEqual(len(sqs.messages), 6)

    def test_queue_failure_keeps_reserved_quota_for_cost_safety(self) -> None:
        repository = FakeRepository()
        service = AnalysisService(
            self.uploads,
            repository,
            FakeSqs(RuntimeError("unavailable")),
            "queue-url",
            30,
            account_limit=5,
        )

        with self.assertRaisesRegex(RuntimeError, "unavailable"):
            service.create("user-1", "waste-images/user-1/image.jpg")

        self.assertEqual(repository.quota["user-1"], 1)
        self.assertIn(repository.failed[0][0], repository.records)

    def test_record_creation_failure_releases_reserved_quota(self) -> None:
        repository = FakeRepository(RuntimeError("write failed"))
        service = AnalysisService(
            self.uploads,
            repository,
            FakeSqs(),
            "queue-url",
            30,
            account_limit=5,
        )

        with self.assertRaisesRegex(RuntimeError, "write failed"):
            service.create("user-1", "waste-images/user-1/image.jpg")

        self.assertEqual(repository.quota["user-1"], 0)

    def test_analysis_service_hides_other_owner(self) -> None:
        repository = FakeRepository()
        repository.records["analysis-1"] = {
            "id": "analysis-1",
            "owner": "user-2",
        }
        service = AnalysisService(
            self.uploads, repository, FakeSqs(), "queue-url", 30
        )

        with self.assertRaises(AnalysisNotFoundError):
            service.get_for_owner("user-1", "analysis-1")

    def test_analysis_service_does_not_expose_internal_quota_record(self) -> None:
        repository = FakeRepository()
        repository.records["quota"] = {
            "id": "quota",
            "owner": "user-1",
            "record_type": "analysis_quota",
        }
        service = AnalysisService(
            self.uploads, repository, FakeSqs(), "queue-url", 30
        )

        with self.assertRaises(AnalysisNotFoundError):
            service.get_for_owner("user-1", "quota")

    def test_worker_writes_vlm_observation(self) -> None:
        repository = FakeRepository()
        observation = {
            "scene_type": "single_item",
            "items": [],
            "notes": "test",
        }

        process_record(
            {
                "body": json.dumps(
                    {
                        "analysis_id": "analysis-1",
                        "owner": "user-1",
                        "image_key": "waste-images/user-1/image.jpg",
                    }
                )
            },
            repository,
            self.s3,
            FakeVlmClient(observation),
            "images",
            1024,
        )

        self.assertEqual(repository.processing[0][0], "analysis-1")
        self.assertEqual(repository.completed[0][2], observation)

    def test_worker_persists_permanent_vlm_rejection(self) -> None:
        repository = FakeRepository()

        process_record(
            {
                "body": json.dumps(
                    {
                        "analysis_id": "analysis-1",
                        "owner": "user-1",
                        "image_key": "waste-images/user-1/image.jpg",
                    }
                )
            },
            repository,
            self.s3,
            FakeVlmClient(error=VlmResponseError(415, "unsupported")),
            "images",
            1024,
        )

        self.assertEqual(repository.failed[0][0], "analysis-1")
        self.assertEqual(repository.completed, [])

    def test_worker_blocks_prompt_injection_before_persisting_observation(self) -> None:
        repository = FakeRepository()

        process_record(
            {
                "body": json.dumps(
                    {
                        "analysis_id": "analysis-1",
                        "owner": "user-1",
                        "image_key": "waste-images/user-1/image.jpg",
                    }
                )
            },
            repository,
            self.s3,
            FakeVlmClient(
                guardrail={
                    "prompt_injection_detected": True,
                    "risk_level": "high",
                    "signals": ["policy_bypass_request"],
                }
            ),
            "images",
            1024,
        )

        self.assertEqual(repository.completed, [])
        self.assertIn("instruction-like text", repository.failed[0][2])

    def test_worker_raises_transient_vlm_failure_for_sqs_retry(self) -> None:
        with self.assertRaises(VlmResponseError):
            process_record(
                {
                    "body": json.dumps(
                        {
                            "analysis_id": "analysis-1",
                            "owner": "user-1",
                            "image_key": "waste-images/user-1/image.jpg",
                        }
                    )
                },
                FakeRepository(),
                self.s3,
                FakeVlmClient(error=VlmResponseError(503, "unavailable")),
                "images",
                1024,
            )

    def test_repository_converts_vlm_floats_for_dynamodb(self) -> None:
        table = FakeTable()
        repository = AnalysisRepository(table)

        repository.mark_completed(
            "analysis-1",
            "2026-08-05T00:00:00+00:00",
            {"items": [{"confidence": 0.75}]},
        )

        confidence = table.update_request["ExpressionAttributeValues"][
            ":observation"
        ]["items"][0]["confidence"]
        self.assertEqual(confidence, Decimal("0.75"))

    def test_repository_decodes_dynamodb_numbers_for_api_contract(self) -> None:
        repository = AnalysisRepository(
            FakeTable(
                {
                    "id": "analysis-1",
                    "observation": {
                        "items": [
                            {
                                "id": Decimal("1"),
                                "quantity": Decimal("2"),
                                "confidence": Decimal("0.75"),
                                "bbox": [
                                    Decimal("0"),
                                    Decimal("100"),
                                    Decimal("900"),
                                    Decimal("1000"),
                                ],
                            }
                        ]
                    },
                }
            )
        )

        record = repository.get("analysis-1")
        item = record["observation"]["items"][0]

        self.assertEqual(item["id"], 1)
        self.assertIsInstance(item["id"], int)
        self.assertEqual(item["quantity"], 2)
        self.assertEqual(item["confidence"], 0.75)
        self.assertIsInstance(item["confidence"], float)
        self.assertEqual(item["bbox"], [0, 100, 900, 1000])

    def test_repository_quota_counter_is_atomic_and_account_scoped(self) -> None:
        table = FakeQuotaTable()
        repository = AnalysisRepository(table)

        for _ in range(5):
            repository.reserve_quota("user-1", 5)

        with self.assertRaises(AnalysisQuotaLimitReachedError):
            repository.reserve_quota("user-1", 5)
        repository.reserve_quota("user-2", 5)

        self.assertEqual(table.counts["analysis-quota#user-1"], 5)
        self.assertEqual(table.counts["analysis-quota#user-2"], 1)
        self.assertEqual(
            table.last_update_request["ExpressionAttributeNames"],
            {"#owner": "owner"},
        )
        self.assertIn("#owner = if_not_exists(#owner", table.last_update_request["UpdateExpression"])


if __name__ == "__main__":
    unittest.main()
