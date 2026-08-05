import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

from jsonschema.exceptions import ValidationError

from .preprocessing import VLM_ROOT, prepare_image
from .providers import VisionProvider, create_provider
from .providers.base import ProviderResponseError, prompt_text
from .schemas import SCHEMA, structured_output_schema, validate_observation

CACHE_DIR = Path(os.getenv("VLM_CACHE_DIR", str(VLM_ROOT / ".vlm_cache")))
CACHE_VERSION = "waste-observation-v3"
PROMPT_PATH = VLM_ROOT / "prompts" / "waste_classifier.txt"


def _progress(step: int, message: str, enabled: bool) -> None:
    if enabled:
        print(f"[{step}/5] {'■' * step}{'□' * (5 - step)} {message}")


@lru_cache(maxsize=1)
def get_provider() -> VisionProvider:
    return create_provider()


def _cache_namespace(provider: VisionProvider, system_prompt: str) -> str:
    payload = json.dumps(
        {
            "cache_version": CACHE_VERSION,
            "provider": provider.cache_key,
            "prompt": system_prompt,
            "schema": SCHEMA,
        },
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def extract(
    image_path: str | Path,
    use_cache: bool = True,
    verbose: bool = False,
    provider: VisionProvider | None = None,
) -> dict:
    _progress(1, "이미지 불러오는 중", verbose)
    prepared = prepare_image(image_path)
    _progress(2, "이미지 최적화·인코딩 완료", verbose)

    selected_provider = provider or get_provider()
    system_prompt = prompt_text(PROMPT_PATH)
    namespace = _cache_namespace(selected_provider, system_prompt)
    cache_file = CACHE_DIR / f"{namespace}_{prepared.digest}.json"
    if use_cache and cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            validate_observation(cached)
        except (json.JSONDecodeError, ValidationError):
            cache_file.unlink(missing_ok=True)
        else:
            _progress(5, "캐시 결과 사용", verbose)
            return cached

    _progress(3, f"VLM 분석 요청 ({selected_provider.cache_key})", verbose)
    result = selected_provider.analyze(
        prepared,
        system_prompt=system_prompt,
        schema=structured_output_schema(),
    )
    try:
        validate_observation(result)
    except ValidationError as error:
        raise ProviderResponseError(
            f"VLM observation did not match the internal schema: {error.message}"
        ) from error

    _progress(4, "구조화된 응답 검증 완료", verbose)
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    _progress(5, "결과 저장 완료", verbose)
    return result
