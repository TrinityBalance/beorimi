import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

MEBIBYTE = 1024 * 1024
MAX_CONTRACT_UPLOAD_MEBIBYTES = 10


@dataclass(frozen=True)
class VlmSettings:
    service_token: str
    max_upload_bytes: int

    @classmethod
    def from_env(cls) -> "VlmSettings":
        raw_limit = os.getenv("VLM_MAX_UPLOAD_MB", "10")
        try:
            limit_mebibytes = int(raw_limit)
        except ValueError as error:
            raise ValueError("VLM_MAX_UPLOAD_MB must be an integer") from error
        if not 1 <= limit_mebibytes <= MAX_CONTRACT_UPLOAD_MEBIBYTES:
            raise ValueError(
                "VLM_MAX_UPLOAD_MB must be between 1 and "
                f"{MAX_CONTRACT_UPLOAD_MEBIBYTES}"
            )
        return cls(
            service_token=os.getenv("VLM_SERVICE_TOKEN", ""),
            max_upload_bytes=limit_mebibytes * MEBIBYTE,
        )


@lru_cache(maxsize=1)
def get_settings() -> VlmSettings:
    return VlmSettings.from_env()
