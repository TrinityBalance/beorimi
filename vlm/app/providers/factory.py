import os

from .base import VisionProvider
from .openai_provider import OpenAIVisionProvider


def create_provider() -> VisionProvider:
    provider_name = os.getenv("VLM_PROVIDER", "openai").strip().lower()
    if provider_name == "openai":
        return OpenAIVisionProvider()
    raise RuntimeError(f"Unsupported VLM_PROVIDER: {provider_name}")
