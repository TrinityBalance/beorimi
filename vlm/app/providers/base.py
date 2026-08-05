from pathlib import Path
from typing import Protocol

from ..preprocessing import PreparedImage


class ProviderError(RuntimeError):
    """Base error raised by a VLM provider."""


class ProviderConfigurationError(ProviderError):
    """The provider cannot start because required configuration is missing."""


class ProviderTimeoutError(ProviderError):
    """The provider did not answer before the configured timeout."""


class ProviderUnavailableError(ProviderError):
    """The provider is temporarily unavailable or rate limited."""


class ProviderResponseError(ProviderError):
    """The provider returned an incomplete or invalid observation."""


class VisionProvider(Protocol):
    @property
    def cache_key(self) -> str:
        """Return a stable identifier for cache separation."""

    def analyze(
        self,
        image: PreparedImage,
        *,
        system_prompt: str,
        schema: dict,
    ) -> dict:
        """Analyze one prepared image and return the shared observation shape."""


def prompt_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()
