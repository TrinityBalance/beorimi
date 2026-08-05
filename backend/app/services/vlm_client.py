import httpx


class VlmClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def analyze(
        self, filename: str, content: bytes, content_type: str
    ) -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/analyze",
                files={"file": (filename, content, content_type)},
            )
            response.raise_for_status()
            return response.json()
