import asyncio
import unittest

import httpx

from backend.app.services.vlm_client import (
    SERVICE_TOKEN_HEADER,
    VlmClient,
    VlmConfigurationError,
    VlmGuardrailError,
    VlmResponseError,
)


def _envelope(observation: dict, guardrail: dict | None = None) -> dict:
    return {
        "observation": observation,
        "guardrail": guardrail
        or {
            "prompt_injection_detected": False,
            "risk_level": "none",
            "signals": [],
        },
    }


class VlmClientTests(unittest.TestCase):
    def test_service_token_is_sent_to_vlm(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers[SERVICE_TOKEN_HEADER], "secret")
            return httpx.Response(
                200,
                json=_envelope(
                    {"scene_type": "unclear", "items": [], "notes": "test"}
                ),
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
                json=_envelope(
                    {"scene_type": "unclear", "items": [], "notes": "test"}
                ),
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

    def test_response_outside_shared_contract_is_reported_as_upstream_error(
        self,
    ) -> None:
        transport = httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json=_envelope(
                    {"scene_type": "unclear", "items": [], "notes": 123}
                ),
            )
        )
        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=transport,
        )

        with self.assertRaises(VlmResponseError) as raised:
            client.analyze_sync("waste.jpg", b"image", "image/jpeg")

        self.assertEqual(raised.exception.status_code, 502)

    def test_vlm_specific_public_enum_values_are_accepted(self) -> None:
        observation = {
            "scene_type": "single_item",
            "items": [
                {
                    "id": 1,
                    "label": "알 수 없는 대형 물체",
                    "category": "unknown",
                    "material": "unknown",
                    "quantity": 1,
                    "longest_side_cm": 120,
                    "size_basis": "visible_label",
                    "reference_object": "제품 규격 라벨",
                    "condition": "unknown",
                    "contamination": "unknown",
                    "confidence": 0.4,
                    "needs_user_confirmation": True,
                    "confirm_question": "품목명을 확인해주세요.",
                    "bbox": [0, 10, 990, 1000],
                }
            ],
            "notes": "확인 필요",
        }
        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=_envelope(observation))
            ),
        )

        result = client.analyze_sync("waste.jpg", b"image", "image/jpeg")

        self.assertEqual(result, observation)

    def test_prompt_injection_signal_is_blocked(self) -> None:
        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json=_envelope(
                        {"scene_type": "unclear", "items": [], "notes": ""},
                        {
                            "prompt_injection_detected": True,
                            "risk_level": "high",
                            "signals": ["system_prompt_extraction"],
                        },
                    ),
                )
            ),
        )

        with self.assertRaises(VlmGuardrailError):
            client.analyze_sync("waste.jpg", b"image", "image/jpeg")

    def test_raw_result_retains_guardrail_for_worker_graph(self) -> None:
        client = VlmClient(
            "https://vlm.example.com",
            "secret",
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json=_envelope(
                        {"scene_type": "unclear", "items": [], "notes": ""}
                    ),
                )
            ),
        )

        result = client.analyze_result_sync("waste.jpg", b"image", "image/jpeg")

        self.assertEqual(result["guardrail"]["risk_level"], "none")


if __name__ == "__main__":
    unittest.main()
