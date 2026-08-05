import json
import os
from pathlib import Path

from .model_loader import MODEL, create_client
from .preprocessing import VLM_ROOT, prepare_image
from .schemas import SCHEMA

CACHE_DIR = Path(os.getenv("VLM_CACHE_DIR", str(VLM_ROOT / ".vlm_cache")))
CACHE_VERSION = "bulky-waste-v1"
PROMPT_PATH = VLM_ROOT / "prompts" / "waste_classifier.txt"
USER_PROMPT = (
    "사진에서 재활용품을 제외한 대형 폐기물 후보 전체의 종류, 위치, "
    "개별 크기를 판독해줘."
)


def _progress(step: int, message: str, enabled: bool) -> None:
    if enabled:
        print(f"[{step}/5] {'■' * step}{'□' * (5 - step)} {message}")


def extract(
    image_path: str | Path, use_cache: bool = True, verbose: bool = False
) -> dict:
    _progress(1, "이미지 불러오는 중", verbose)
    encoded_image, digest = prepare_image(image_path)
    _progress(2, "이미지 최적화·인코딩 완료", verbose)

    cache_file = CACHE_DIR / f"{CACHE_VERSION}_{digest}.json"
    if use_cache and cache_file.exists():
        _progress(5, "캐시 결과 사용", verbose)
        return json.loads(cache_file.read_text(encoding="utf-8"))

    client = create_client()
    _progress(3, f"OpenAI VLM 분석 요청 ({MODEL})", verbose)
    response = client.responses.create(
        model=MODEL,
        input=[
            {
                "role": "system",
                "content": PROMPT_PATH.read_text(encoding="utf-8"),
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": USER_PROMPT},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{encoded_image}",
                    },
                ],
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "waste_observation",
                "strict": True,
                "schema": SCHEMA,
            }
        },
    )

    if not response.output_text:
        raise RuntimeError("The model returned no structured output.")

    _progress(4, "구조화된 응답 검증 완료", verbose)
    result = json.loads(response.output_text)
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    _progress(5, "결과 저장 완료", verbose)
    return result
