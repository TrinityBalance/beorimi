"""
1단계 VLM 추출 모듈 — "무엇이 보이는가"만 뽑음.
수수료 계산 / 무상수거 판정 / 배출일 산정은 여기서 절대 안 함. (2단계 코드 담당)

사용:
    from vlm_extract import extract
    result = extract("photos/sofa.jpg")
"""

import base64
import hashlib
import io
import json
import os
from pathlib import Path
from dotenv import load_dotenv

from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

load_dotenv()

# 모델 ID는 공식 문서에서 현재 사용 가능한 비전 지원 mini급으로 교체할 것
MODEL = os.getenv("VLM_MODEL", "gpt-5.6")
MAX_EDGE = 1024
CACHE_DIR = Path(os.getenv("VLM_CACHE_DIR", ".vlm_cache"))
CACHE_VERSION = "bulky-waste-v1"

# ---------------------------------------------------------------- 스키마

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["scene_type", "items", "notes"],
    "properties": {
        "scene_type": {
            "type": "string",
            "enum": ["single_item", "multi_item", "unclear"],
        },
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "id", "label", "category", "material", "quantity",
                    "longest_side_cm", "size_basis", "reference_object",
                    "condition", "contamination", "confidence",
                    "needs_user_confirmation", "confirm_question", "bbox",
                ],
                "properties": {
                    "id": {"type": "integer"},
                    "label": {
                        "type": "string",
                        "description": "한국어 품목명. 수수료표 매칭에 쓰이므로 일반명사로. 예: '소파', '냉장고', '플라스틱 배달용기'",
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "furniture",         # 가구
                            "appliance_large",   # 대형가전
                            "appliance_small",   # 소형가전
                            "bedding",           # 침구/매트리스
                            "container",         # 용기류
                            "packaging",         # 포장재
                            "textile",           # 의류/천
                            "battery_lamp",      # 폐건전지/형광등
                            "other",
                        ],
                    },
                    "material": {
                        "type": "string",
                        "enum": ["fabric", "wood", "metal", "plastic",
                                 "glass", "paper", "mixed", "unknown"],
                    },
                    "quantity": {"type": "integer"},
                    "longest_side_cm": {
                        "type": ["integer", "null"],
                        "description": "가장 긴 변의 추정 길이(cm). 근거 없으면 null.",
                    },
                    "size_basis": {
                        "type": "string",
                        "enum": ["reference_object", "typical_product", "unknown"],
                        "description": "reference_object일 때만 수치를 신뢰할 수 있음",
                    },
                    "reference_object": {
                        "type": ["string", "null"],
                        "description": "크기 추정에 사용한 참조물. 없으면 null",
                    },
                    "condition": {
                        "type": "string",
                        "enum": ["intact", "minor_damage", "broken", "unknown"],
                        "description": "외관상 원형 보존 여부만. 작동 여부는 알 수 없으므로 판단 금지",
                    },
                    "contamination": {
                        "type": "string",
                        "enum": ["clean", "residue", "unknown"],
                        "description": "재활용 가능 여부 판정용. 음식물/이물 잔여 여부",
                    },
                    "confidence": {"type": "number"},
                    "needs_user_confirmation": {"type": "boolean"},
                    "bbox": {
                        "type": ["array", "null"],
                        "items": {"type": "integer", "minimum": 0, "maximum": 1000},
                        "minItems": 4,
                        "maxItems": 4,
                        "description": "Object location [left, top, right, bottom] normalized to 0-1000. Use null when uncertain.",
                    },
                    "confirm_question": {
                        "type": ["string", "null"],
                        "description": "확인 필요 시 사용자에게 던질 한 문장. 아니면 null",
                    },
                },
            },
        },
        "notes": {
            "type": "string",
            "description": "판독 불가 요소나 주의사항. 없으면 빈 문자열",
        },
    },
}


# ---------------------------------------------------------------- 프롬프트

SYSTEM_PROMPT = """\
사진 속 재활용품을 제외한 대형 폐기물 후보를 판독한다.

- 가구, 침구, 매트리스, 대형 가전, 대형 용기, 대형 포장재, 섬유류를 판독한다.
- 종이·박스·캔·페트·유리병·비닐·재활용 포장재는 제외한다.
- 도로, 나무, 벽 등 배경은 제외한다.
- 실제 물체 하나당 item 하나를 반환한다. 같은 종류라도 합치지 않으며 quantity는 항상 1이다.
- 각 물체의 최장 길이(longest_side_cm)를 개별 추정한다.
- bbox는 [left, top, right, bottom]이며 이미지 가로·세로를 각각 0~1000으로 정규화한다.
- 크기나 종류가 불확실하면 낮은 confidence와 확인 질문을 사용한다.
- 수수료, 배출 가능 여부, 재활용 가능 여부의 최종 판단은 하지 않는다.
"""

USER_PROMPT = "사진에서 재활용품을 제외한 대형 폐기물 후보 전체의 종류, 위치, 개별 크기를 판독해줘."


# ---------------------------------------------------------------- 유틸


def _prepare_image(path: str) -> tuple[str, str]:
    """긴 변 MAX_EDGE로 리사이즈 후 base64. (b64, sha1) 반환."""
    img = Image.open(path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_EDGE:
        scale = MAX_EDGE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    raw = buf.getvalue()
    return base64.b64encode(raw).decode(), hashlib.sha1(raw).hexdigest()


def _cache_path(digest: str) -> Path:
    return CACHE_DIR / f"{CACHE_VERSION}_{digest}.json"


def _progress(step: int, message: str, enabled: bool) -> None:
    if enabled:
        print(f"[{step}/5] {'■' * step}{'□' * (5 - step)} {message}")


def render_overlay(image_path: str, result: dict, output_path: str | Path) -> Path:
    image = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    font_size = max(18, width // 38)
    font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", font_size)
    colors = ["#00E5FF", "#FFEA00", "#FF4081", "#69F0AE", "#B388FF"]

    for index, item in enumerate(result.get("items", [])):
        bbox = item.get("bbox")
        if not bbox:
            continue
        left, top, right, bottom = bbox
        x1, y1 = left * width / 1000, top * height / 1000
        x2, y2 = right * width / 1000, bottom * height / 1000
        color = colors[index % len(colors)]
        draw.rectangle((x1, y1, x2, y2), outline=color, width=max(3, width // 250))
        size = item.get("longest_side_cm")
        size_text = f"약 {size}cm" if size is not None else "크기 확인 필요"
        label = f"{item['id']}. {item['label']} · {size_text} · {item['confidence']:.0%}"
        text_box = draw.textbbox((x1, y1), label, font=font)
        label_top = max(0, y1 - (text_box[3] - text_box[1] + 10))
        draw.rounded_rectangle((x1, label_top, text_box[2] + 10, y1), radius=5, fill=color)
        draw.text((x1 + 5, label_top + 3), label, fill="black", font=font)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=95)
    return output


# ---------------------------------------------------------------- 메인

def extract(image_path: str, use_cache: bool = True, verbose: bool = False) -> dict:
    """
    사진 → 관찰 결과 dict.
    캐시 히트 시 API 호출 없음. 시연 중 네트워크/레이트리밋 사고 대비.
    """
    _progress(1, "이미지 불러오는 중", verbose)
    b64, digest = _prepare_image(image_path)
    _progress(2, "이미지 최적화·인코딩 완료", verbose)

    cache_file = _cache_path(digest)
    if use_cache and cache_file.exists():
        _progress(5, "캐시 결과 사용", verbose)
        return json.loads(cache_file.read_text(encoding="utf-8"))

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError(".env에 OPENAI_API_KEY를 설정해줘.")

    client = OpenAI(api_key=api_key)
    _progress(3, f"OpenAI VLM 분석 요청 ({MODEL})", verbose)
    response = client.responses.create(
        model=MODEL,
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": USER_PROMPT},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{b64}",
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
        raise RuntimeError("모델이 구조화된 응답을 반환하지 않았어.")

    _progress(4, "구조화된 응답 검증 완료", verbose)
    result = json.loads(response.output_text)

    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    _progress(5, "결과 저장 완료", verbose)

    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="VLM image extraction")
    parser.add_argument("images", nargs="+", help="image paths")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--overlay", action="store_true")
    parser.add_argument("--output-dir", default="vlm_overlays")
    args = parser.parse_args()

    for p in args.images:
        print(f"\n=== {p} ===")
        result = extract(p, use_cache=not args.no_cache, verbose=args.verbose)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.overlay:
            output = Path(args.output_dir) / f"{Path(p).stem}_overlay.jpg"
            print(f"Overlay saved: {render_overlay(p, result, output)}")
