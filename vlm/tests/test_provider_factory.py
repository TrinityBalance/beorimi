import os
import unittest
from unittest.mock import patch

from vlm.app.providers.factory import create_provider
from vlm.app.providers.openai_provider import OpenAIVisionProvider


class ProviderFactoryTests(unittest.TestCase):
    def test_openai_is_the_default_provider(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            provider = create_provider()

        self.assertIsInstance(provider, OpenAIVisionProvider)
        self.assertEqual(provider.model, "gpt-5.6-sol")

    def test_unknown_provider_is_rejected(self) -> None:
        with patch.dict(os.environ, {"VLM_PROVIDER": "missing"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "Unsupported VLM_PROVIDER"):
                create_provider()


if __name__ == "__main__":
    unittest.main()
