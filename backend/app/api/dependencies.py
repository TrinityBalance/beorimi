from ..core.config import Settings, settings
from ..services.vlm_client import VlmClient


def get_settings() -> Settings:
    return settings


def get_vlm_client() -> VlmClient:
    return VlmClient(settings.vlm_base_url)
