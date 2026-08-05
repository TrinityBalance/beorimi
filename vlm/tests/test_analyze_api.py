import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from vlm.app.main import app
from vlm.app.providers.base import ProviderUnavailableError


class AnalyzeEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_invalid_image_content_returns_400(self) -> None:
        response = self.client.post(
            "/analyze",
            files={"file": ("waste.jpg", b"not-an-image", "image/jpeg")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid image file")

    def test_provider_unavailable_returns_503(self) -> None:
        with patch(
            "vlm.app.main.extract",
            side_effect=ProviderUnavailableError("provider unavailable"),
        ):
            response = self.client.post(
                "/analyze",
                files={"file": ("waste.jpg", b"content", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "provider unavailable")

    def test_oversized_upload_returns_413(self) -> None:
        with patch("vlm.app.main.MAX_UPLOAD_BYTES", 3):
            response = self.client.post(
                "/analyze",
                files={"file": ("waste.jpg", b"four", "image/jpeg")},
            )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["detail"], "Image file is too large")


if __name__ == "__main__":
    unittest.main()
