import unittest
from decimal import Decimal

from fastapi.testclient import TestClient

from backend.app.api.auth import AuthenticatedUser, get_current_user
from backend.app.api.dependencies import get_analysis_service, get_upload_service
from backend.app.main import app
from backend.app.services.analysis_service import (
    AnalysisNotFoundError,
    AnalysisQuotaExceededError,
)
from backend.app.services.upload_service import (
    UploadedObjectNotFoundError,
    UploadValidationError,
)


class FakeUploadService:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    def create_upload_url(
        self, owner: str, filename: str, content_type: str, size_bytes: int
    ) -> dict:
        if self.error:
            raise self.error
        return {
            "upload_url": "https://upload.example.invalid",
            "image_key": f"waste-images/{owner}/image.jpg",
            "expires_in": 300,
            "form_fields": {
                "key": f"waste-images/{owner}/image.jpg",
                "Content-Type": content_type,
            },
        }


class FakeAnalysisService:
    def __init__(
        self,
        result: dict | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = result
        self.error = error

    def create(self, owner: str, image_key: str) -> dict:
        if self.error:
            raise self.error
        return self.result or analysis_record(owner, image_key)

    def get_for_owner(self, owner: str, analysis_id: str) -> dict:
        if self.error:
            raise self.error
        return self.result or analysis_record(
            owner, f"waste-images/{owner}/image.jpg", analysis_id
        )


def analysis_record(
    owner: str, image_key: str, analysis_id: str = "analysis-1"
) -> dict:
    return {
        "id": analysis_id,
        "owner": owner,
        "image_key": image_key,
        "status": "queued",
        "created_at": "2026-08-05T00:00:00+00:00",
        "updated_at": "2026-08-05T00:00:00+00:00",
    }


class SecureApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        app.dependency_overrides[get_upload_service] = lambda: FakeUploadService()
        app.dependency_overrides[get_analysis_service] = lambda: FakeAnalysisService()

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def authenticate(self, sub: str = "user-123") -> None:
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            sub=sub,
            claims={"sub": sub},
        )

    def test_secure_endpoint_requires_gateway_jwt_claims(self) -> None:
        response = self.client.post(
            "/api/uploads",
            json={
                "filename": "waste.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 100,
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_upload_url_uses_authenticated_user_prefix(self) -> None:
        self.authenticate()

        response = self.client.post(
            "/api/uploads",
            json={
                "filename": "waste.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 100,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["image_key"],
            "waste-images/user-123/image.jpg",
        )
        self.assertEqual(
            response.json()["form_fields"]["Content-Type"], "image/jpeg"
        )

    def test_upload_validation_error_returns_400(self) -> None:
        self.authenticate()
        app.dependency_overrides[get_upload_service] = lambda: FakeUploadService(
            UploadValidationError("Unsupported image format")
        )

        response = self.client.post(
            "/api/uploads",
            json={
                "filename": "waste.txt",
                "content_type": "text/plain",
                "size_bytes": 100,
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_create_analysis_returns_202(self) -> None:
        self.authenticate()

        response = self.client.post(
            "/api/analyses",
            json={"image_key": "waste-images/user-123/image.jpg"},
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "queued")

    def test_create_analysis_missing_image_returns_404(self) -> None:
        self.authenticate()
        app.dependency_overrides[get_analysis_service] = lambda: FakeAnalysisService(
            error=UploadedObjectNotFoundError("Uploaded image was not found")
        )

        response = self.client.post(
            "/api/analyses",
            json={"image_key": "waste-images/user-123/missing.jpg"},
        )

        self.assertEqual(response.status_code, 404)

    def test_create_analysis_returns_429_after_account_limit(self) -> None:
        self.authenticate()
        app.dependency_overrides[get_analysis_service] = lambda: FakeAnalysisService(
            error=AnalysisQuotaExceededError(
                "Account analysis limit of 5 has been reached"
            )
        )

        response = self.client.post(
            "/api/analyses",
            json={"image_key": "waste-images/user-123/image.jpg"},
        )

        self.assertEqual(response.status_code, 429)

    def test_get_analysis_hides_other_users_records(self) -> None:
        self.authenticate()
        app.dependency_overrides[get_analysis_service] = lambda: FakeAnalysisService(
            error=AnalysisNotFoundError("Analysis was not found")
        )

        response = self.client.get("/api/analyses/other-users-analysis")

        self.assertEqual(response.status_code, 404)

    def test_get_completed_analysis_serializes_validated_vlm_observation(
        self,
    ) -> None:
        self.authenticate()
        record = analysis_record(
            "user-123",
            "waste-images/user-123/image.jpg",
        )
        record.update(
            {
                "status": "completed",
                "observation": {
                    "scene_type": "single_item",
                    "items": [
                        {
                            "id": 1,
                            "label": "소파",
                            "category": "furniture",
                            "material": "fabric",
                            "quantity": 1,
                            "longest_side_cm": None,
                            "size_basis": "unknown",
                            "reference_object": None,
                            "condition": "intact",
                            "contamination": "clean",
                            "confidence": Decimal("0.88"),
                            "needs_user_confirmation": True,
                            "confirm_question": "크기를 확인해주세요.",
                            "bbox": [100, 200, 900, 900],
                        }
                    ],
                    "notes": "",
                },
            }
        )
        app.dependency_overrides[get_analysis_service] = lambda: FakeAnalysisService(
            result=record
        )

        response = self.client.get("/api/analyses/analysis-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["observation"]["items"][0]["confidence"], 0.88)


if __name__ == "__main__":
    unittest.main()
