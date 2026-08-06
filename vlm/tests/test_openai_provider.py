import json
import unittest
from types import SimpleNamespace

from vlm.app.preprocessing import PreparedImage
from vlm.app.providers.base import ProviderResponseError
from vlm.app.providers.openai_provider import OpenAIVisionProvider
from vlm.tests.sample_observation import sample_observation


class FakeResponses:
    def __init__(self, response: SimpleNamespace) -> None:
        self.response = response
        self.request: dict | None = None

    def create(self, **kwargs) -> SimpleNamespace:
        self.request = kwargs
        return self.response


class FakeClient:
    def __init__(self, response: SimpleNamespace) -> None:
        self.responses = FakeResponses(response)


def prepared_image() -> PreparedImage:
    return PreparedImage(
        jpeg_bytes=b"jpeg",
        digest="digest",
        width=100,
        height=100,
    )


class OpenAIVisionProviderTests(unittest.TestCase):
    def test_sends_private_original_detail_structured_request(self) -> None:
        expected = sample_observation()
        response = SimpleNamespace(
            status="completed",
            incomplete_details=None,
            output=[],
            output_text=json.dumps(expected, ensure_ascii=False),
        )
        client = FakeClient(response)
        provider = OpenAIVisionProvider(client=client, model="test-model")

        result = provider.analyze(
            prepared_image(),
            system_prompt="system",
            schema={"type": "object"},
        )

        self.assertEqual(result, expected)
        request = client.responses.request
        assert request is not None
        self.assertEqual(request["model"], "test-model")
        self.assertFalse(request["store"])
        user_prompt = request["input"][1]["content"][0]["text"]
        self.assertIn("0~1000", user_prompt)
        self.assertIn("보이는 픽셀", user_prompt)
        self.assertIn("재활용품", user_prompt)
        self.assertEqual(request["input"][1]["content"][1]["detail"], "original")
        self.assertTrue(request["text"]["format"]["strict"])

    def test_incomplete_response_is_rejected(self) -> None:
        response = SimpleNamespace(
            status="incomplete",
            incomplete_details=SimpleNamespace(reason="max_output_tokens"),
            output=[],
            output_text="",
        )
        provider = OpenAIVisionProvider(client=FakeClient(response))

        with self.assertRaisesRegex(ProviderResponseError, "incomplete"):
            provider.analyze(
                prepared_image(),
                system_prompt="system",
                schema={"type": "object"},
            )


if __name__ == "__main__":
    unittest.main()
