import httpx
from pydantic import ValidationError

from ..agents.graph import PROMPT_INJECTION_BLOCK_MESSAGE, evaluate_vlm_result
from ..schemas.vlm import VlmAnalysisResult

SERVICE_TOKEN_HEADER = "X-Beorimi-Service-Token"


class VlmServiceError(Exception):
    pass


class VlmConfigurationError(VlmServiceError):
    pass


class VlmConnectionError(VlmServiceError):
    pass


class VlmTimeoutError(VlmServiceError):
    pass


class VlmGuardrailError(VlmServiceError):
    pass


class VlmResponseError(VlmServiceError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class VlmClient:
    def __init__(
        self,
        base_url: str,
        service_token: str,
        timeout_seconds: float = 90.0,
        transport: httpx.BaseTransport | httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_token = service_token
        self.timeout = httpx.Timeout(timeout_seconds, connect=5.0)
        self.transport = transport

    def _request_kwargs(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        if not self.service_token:
            raise VlmConfigurationError("VLM service token is not configured")
        return {
            "url": f"{self.base_url}/analyze",
            "headers": {SERVICE_TOKEN_HEADER: self.service_token},
            "files": {"file": (filename, content, content_type)},
        }

    @staticmethod
    def _parse_response(response: httpx.Response) -> dict:
        if response.is_error:
            try:
                detail = str(response.json().get("detail", "VLM request failed"))
            except (ValueError, AttributeError):
                detail = "VLM request failed"
            raise VlmResponseError(response.status_code, detail)

        try:
            payload = response.json()
        except ValueError as error:
            raise VlmResponseError(502, "VLM returned invalid JSON") from error
        try:
            return VlmAnalysisResult.model_validate(payload).model_dump(mode="json")
        except ValidationError as error:
            raise VlmResponseError(
                502,
                "VLM returned a response that does not match the internal contract",
            ) from error

    @staticmethod
    def _guard_observation(result: dict) -> dict:
        state = evaluate_vlm_result(
            result["observation"],
            result["guardrail"],
        )
        if state["status"] == "blocked":
            raise VlmGuardrailError(PROMPT_INJECTION_BLOCK_MESSAGE)
        return state["observation"]

    async def analyze_result(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.post(
                    **self._request_kwargs(filename, content, content_type)
                )
        except httpx.TimeoutException as error:
            raise VlmTimeoutError("VLM request timed out") from error
        except httpx.RequestError as error:
            raise VlmConnectionError("VLM service is unreachable") from error

        return self._parse_response(response)

    async def analyze(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        result = await self.analyze_result(filename, content, content_type)
        return self._guard_observation(result)

    def analyze_result_sync(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        try:
            with httpx.Client(
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = client.post(
                    **self._request_kwargs(filename, content, content_type)
                )
        except httpx.TimeoutException as error:
            raise VlmTimeoutError("VLM request timed out") from error
        except httpx.RequestError as error:
            raise VlmConnectionError("VLM service is unreachable") from error

        return self._parse_response(response)

    def analyze_sync(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        result = self.analyze_result_sync(filename, content, content_type)
        return self._guard_observation(result)
