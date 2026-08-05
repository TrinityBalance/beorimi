import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from vlm.app.config import VlmSettings, get_settings
from vlm.app.api import SERVICE_TOKEN_HEADER, app
from vlm.app.providers.base import ProviderUnavailableError
from vlm.tests.sample_observation import sample_observation


class AnalyzeEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = VlmSettings(
            service_token="test-service-token",
            max_upload_bytes=10 * 1024 * 1024,
        )
        app.dependency_overrides[get_settings] = lambda: self.settings
        self.client = TestClient(app)
        self.headers = {SERVICE_TOKEN_HEADER: self.settings.service_token}

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_invalid_image_content_returns_400(self) -> None:
        response = self.client.post(
            "/analyze",
            headers=self.headers,
            files={"file": ("waste.jpg", b"not-an-image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid image file")

    def test_provider_unavailable_returns_503(self) -> None:
        with patch(
            "vlm.app.api.extract",
            side_effect=ProviderUnavailableError("provider unavailable"),
        ):
            response = self.client.post(
                "/analyze",
                headers=self.headers,
                files={"file": ("waste.jpg", b"content", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "provider unavailable")

    def test_oversized_upload_returns_413(self) -> None:
        app.dependency_overrides[get_settings] = lambda: VlmSettings(
            service_token="test-service-token",
            max_upload_bytes=3,
        )
        response = self.client.post(
            "/analyze",
            headers=self.headers,
            files={"file": ("waste.jpg", b"four", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["detail"], "Image file is too large")

    def test_missing_service_token_configuration_returns_503(self) -> None:
        app.dependency_overrides[get_settings] = lambda: VlmSettings(
            service_token="",
            max_upload_bytes=10 * 1024 * 1024,
        )

        response = self.client.post(
            "/analyze",
            files={"file": ("waste.jpg", b"content", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 503)

    def test_invalid_service_token_returns_401(self) -> None:
        response = self.client.post(
            "/analyze",
            headers={SERVICE_TOKEN_HEADER: "wrong-token"},
            files={"file": ("waste.jpg", b"content", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 401)

    def test_missing_service_token_returns_401(self) -> None:
        response = self.client.post(
            "/analyze",
            files={"file": ("waste.jpg", b"content", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 401)

    def test_internal_observation_is_mapped_to_shared_response(self) -> None:
        with patch("vlm.app.api.extract", return_value=sample_observation()):
            response = self.client.post(
                "/analyze",
                headers=self.headers,
                files={"file": ("waste.jpg", b"content", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["observation"]["items"][0]["longest_side_cm"], None)
        self.assertNotIn("schema_version", payload["observation"])
        self.assertNotIn("alternatives", payload["observation"]["items"][0])
        self.assertEqual(payload["guardrail"]["risk_level"], "none")


if __name__ == "__main__":
    unittest.main()
