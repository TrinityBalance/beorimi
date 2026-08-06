"""환경변수를 읽어 Settings 한 덩어리로 만든다.

os.getenv 는 이 파일에서만 쓰고, 나머지 코드는 settings 객체만 본다.
`_positive_int`/`_positive_float` 는 잘못된 값이 런타임 한참 뒤에 터지지 않도록
import 시점에 바로 실패시킨다 — Lambda 라면 첫 호출에서 즉시 드러난다.
"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _parse_origins(raw: str) -> tuple[str, ...]:
    return tuple(origin.strip() for origin in raw.split(",") if origin.strip())


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    value = default if raw is None else int(raw)
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def _positive_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    value = default if raw is None else float(raw)
    if value <= 0:
        raise ValueError(f"{name} must be a positive number")
    return value


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Beorimi API")
    vlm_base_url: str = os.getenv("VLM_BASE_URL", "http://localhost:8001")
    vlm_service_token: str = os.getenv("VLM_SERVICE_TOKEN", "")
    vlm_timeout_seconds: float = _positive_float("VLM_TIMEOUT_SECONDS", 90.0)
    max_upload_bytes: int = _positive_int("MAX_UPLOAD_BYTES", 4 * 1024 * 1024)
    # AIDEV-NOTE: 배포 시 Amplify 도메인을 반드시 추가해야 프론트 호출이 통과한다.
    #             콤마로 구분하며, 스킴·포트까지 정확히 일치해야 한다(https:// 포함, 끝 슬래시 없음).
    cors_allow_origins: tuple[str, ...] = _parse_origins(
        os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    )
    aws_region: str = os.getenv("AWS_REGION", "ap-northeast-2")
    image_bucket_name: str = os.getenv("IMAGE_BUCKET_NAME", "")
    analysis_table_name: str = os.getenv("ANALYSIS_TABLE_NAME", "")
    analysis_queue_url: str = os.getenv("ANALYSIS_QUEUE_URL", "")
    presigned_url_ttl_seconds: int = _positive_int(
        "PRESIGNED_URL_TTL_SECONDS", 300
    )
    max_source_image_bytes: int = _positive_int(
        "MAX_SOURCE_IMAGE_BYTES", 10 * 1024 * 1024
    )
    analysis_retention_days: int = _positive_int("ANALYSIS_RETENTION_DAYS", 30)
    analysis_account_limit: int = _positive_int("ANALYSIS_ACCOUNT_LIMIT", 5)
    analysis_max_receive_count: int = _positive_int(
        "ANALYSIS_MAX_RECEIVE_COUNT", 3
    )


settings = Settings()
