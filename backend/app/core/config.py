import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _parse_origins(raw: str) -> tuple[str, ...]:
    return tuple(origin.strip() for origin in raw.split(",") if origin.strip())


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Beorimi API")
    vlm_base_url: str = os.getenv("VLM_BASE_URL", "http://localhost:8001")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./beorimi.db")
    # AIDEV-NOTE: 배포 시 Amplify 도메인을 반드시 추가해야 프론트 호출이 통과한다.
    #             콤마로 구분하며, 스킴·포트까지 정확히 일치해야 한다(https:// 포함, 끝 슬래시 없음).
    cors_allow_origins: tuple[str, ...] = _parse_origins(
        os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000")
    )


settings = Settings()
