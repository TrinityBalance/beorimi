import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Beorimi API")
    vlm_base_url: str = os.getenv("VLM_BASE_URL", "http://localhost:8001")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./beorimi.db")


settings = Settings()
