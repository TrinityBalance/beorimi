import json
import os
from typing import Any

import openai
from openai import OpenAI

from ..preprocessing import PreparedImage
from .base import (
    ProviderConfigurationError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

DEFAULT_MODEL = "gpt-5.6-sol"
DEFAULT_TIMEOUT_SECONDS = 60.0
USER_PROMPT = (
    "사진에 실제로 보이는 재활용품 제외 대형 폐기물 후보를 모두 관찰하세요. "
    "품목을 단정할 수 없으면 대안 후보와 사용자 확인 질문을 제공하세요. "
    "각 bbox는 제출된 전체 이미지의 0~1000 좌표에서 해당 물체의 보이는 픽셀에 "
    "밀착시키고, 배경이나 다른 물체를 포함하지 마세요."
)


class OpenAIVisionProvider:
    def __init__(
        self,
        *,
        client: Any | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.model = model or os.getenv("OPENAI_VLM_MODEL", DEFAULT_MODEL)
        self.timeout_seconds = timeout_seconds or float(
            os.getenv("OPENAI_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS))
        )
        self._client = client

    @property
    def cache_key(self) -> str:
        return f"openai:{self.model}:detail-original"

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ProviderConfigurationError("OPENAI_API_KEY is not configured.")

        self._client = OpenAI(
            api_key=api_key,
            timeout=self.timeout_seconds,
            max_retries=2,
        )
        return self._client

    def analyze(
        self,
        image: PreparedImage,
        *,
        system_prompt: str,
        schema: dict,
    ) -> dict:
        try:
            response = self._get_client().responses.create(
                model=self.model,
                store=False,
                input=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": USER_PROMPT},
                            {
                                "type": "input_image",
                                "image_url": image.data_url,
                                "detail": "original",
                            },
                        ],
                    },
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "waste_observation",
                        "strict": True,
                        "schema": schema,
                    }
                },
            )
        except openai.APITimeoutError as error:
            raise ProviderTimeoutError("OpenAI vision request timed out.") from error
        except (openai.APIConnectionError, openai.RateLimitError) as error:
            raise ProviderUnavailableError(
                "OpenAI vision service is temporarily unavailable."
            ) from error
        except openai.APIStatusError as error:
            if error.status_code >= 500:
                raise ProviderUnavailableError(
                    "OpenAI vision service returned a server error."
                ) from error
            raise ProviderResponseError(
                f"OpenAI vision request failed with status {error.status_code}."
            ) from error

        if response.status != "completed":
            reason = getattr(response.incomplete_details, "reason", "unknown")
            raise ProviderResponseError(
                f"OpenAI vision response was incomplete: {reason}."
            )

        for output in response.output:
            for content in getattr(output, "content", []):
                if getattr(content, "type", None) == "refusal":
                    raise ProviderResponseError("OpenAI vision request was refused.")

        if not response.output_text:
            raise ProviderResponseError("OpenAI vision response contained no output.")

        try:
            result = json.loads(response.output_text)
        except json.JSONDecodeError as error:
            raise ProviderResponseError(
                "OpenAI vision response was not valid JSON."
            ) from error

        if not isinstance(result, dict):
            raise ProviderResponseError("OpenAI vision response must be an object.")
        return result
