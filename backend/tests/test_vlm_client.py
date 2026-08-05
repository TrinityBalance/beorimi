import asyncio
import unittest

import httpx

from backend.app.services.vlm_client import (
    SERVICE_TOKEN_HEADER,
    VlmClient,
    VlmConfigurationError,
    VlmResponseError,
)


class VlmClientTests(unittest.TestCase):
    def test_service_token_is_sent_to_vlm(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers[SERVICE_TOKEN_HEADER], "secret")
            return httpx.Response(
                200,
                json={"scene_type": "unclear", "items": [], "notes": "test"},
            )

        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=httpx.MockTransport(handler),
        )

        result = asyncio.run(
            client.analyze("waste.jpg", b"image", "image/jpeg")
        )

        self.assertEqual(result["scene_type"], "unclear")

    def test_missing_service_token_fails_before_request(self) -> None:
        client = VlmClient("https://vlm.example.com", "")

        with self.assertRaises(VlmConfigurationError):
            asyncio.run(client.analyze("waste.jpg", b"image", "image/jpeg"))

    def test_sync_worker_client_sends_service_token(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers[SERVICE_TOKEN_HEADER], "secret")
            return httpx.Response(
                200,
                json={"scene_type": "unclear", "items": [], "notes": "test"},
            )

        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=httpx.MockTransport(handler),
        )

        result = client.analyze_sync("waste.jpg", b"image", "image/jpeg")

        self.assertEqual(result["scene_type"], "unclear")

    def test_invalid_json_is_reported_as_upstream_error(self) -> None:
        transport = httpx.MockTransport(
            lambda request: httpx.Response(200, text="not-json")
        )
        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=transport,
        )

        with self.assertRaises(VlmResponseError) as raised:
            asyncio.run(client.analyze("waste.jpg", b"image", "image/jpeg"))

        self.assertEqual(raised.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
