import unittest

from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_settings, get_vlm_client
from backend.app.core.config import Settings
from backend.app.main import app
from backend.app.services.vlm_client import (
    VlmConnectionError,
    VlmGuardrailError,
    VlmResponseError,
    VlmTimeoutError,
)


class FakeVlmClient:
    def __init__(self, result=None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error

    async def analyze(self, filename: str, content: bytes, content_type: str):
        if self.error is not None:
            raise self.error
        return self.result


class AnalysisEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        app.dependency_overrides[get_settings] = lambda: Settings(
            max_upload_bytes=1024
        )

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def test_analysis_returns_vlm_observation(self) -> None:
        observation = {"scene_type": "unclear", "items": [], "notes": "test"}
        app.dependency_overrides[get_vlm_client] = lambda: FakeVlmClient(
            result=observation
        )

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.jpg", b"image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), observation)

    def test_oversized_image_returns_413_before_vlm_call(self) -> None:
        fake_client = FakeVlmClient(result={})
        app.dependency_overrides[get_settings] = lambda: Settings(
            max_upload_bytes=4
        )
        app.dependency_overrides[get_vlm_client] = lambda: fake_client

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.jpg", b"12345", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 413)

    def test_vlm_timeout_returns_504(self) -> None:
        app.dependency_overrides[get_vlm_client] = lambda: FakeVlmClient(
            error=VlmTimeoutError("timeout")
        )

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.jpg", b"image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 504)

    def test_vlm_connection_error_returns_502(self) -> None:
        app.dependency_overrides[get_vlm_client] = lambda: FakeVlmClient(
            error=VlmConnectionError("unreachable")
        )

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.jpg", b"image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 502)

    def test_prompt_injection_guardrail_returns_400(self) -> None:
        app.dependency_overrides[get_vlm_client] = lambda: FakeVlmClient(
            error=VlmGuardrailError(
                "Image contains instruction-like text and cannot be safely analyzed"
            )
        )

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.jpg", b"image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("instruction-like text", response.json()["detail"])

    def test_vlm_file_error_is_passed_through(self) -> None:
        app.dependency_overrides[get_vlm_client] = lambda: FakeVlmClient(
            error=VlmResponseError(415, "Unsupported image format")
        )

        response = self.client.post(
            "/api/analysis",
            files={"file": ("waste.txt", b"image", "text/plain")},
        )

        self.assertEqual(response.status_code, 415)
        self.assertEqual(response.json()["detail"], "Unsupported image format")


if __name__ == "__main__":
    unittest.main()
