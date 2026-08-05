from .schemas import validate_observation


def to_analysis_response(observation: dict) -> dict:
    """VLM 내부 관찰을 Backend와 Frontend가 쓰는 공용 MVP 계약으로 축약한다."""
    validate_observation(observation)
    items = [
        {
            "id": item["id"],
            "label": item["label"],
            "category": item["category"],
            "material": item["material"],
            "quantity": item["quantity"],
            "longest_side_cm": item["estimated_longest_side_cm"],
            "size_basis": item["size_basis"],
            "reference_object": item["reference_object"],
            "condition": item["condition"],
            "contamination": item["contamination"],
            "confidence": item["confidence"],
            "needs_user_confirmation": item["needs_user_confirmation"],
            "confirm_question": item["confirm_question"],
            "bbox": item["bbox"],
        }
        for item in observation["items"]
    ]
    retake_message = observation["image_quality"]["retake_message"]
    return {
        "scene_type": observation["scene_type"],
        "items": items,
        "notes": observation["notes"] or retake_message or "",
    }


def to_vlm_response(observation: dict) -> dict:
    """Backend 전용 관찰과 보안 신호를 분리한 내부 API 응답을 만든다."""
    public_observation = to_analysis_response(observation)
    security = observation["security"]
    return {
        "observation": public_observation,
        "guardrail": {
            "prompt_injection_detected": security["prompt_injection_detected"],
            "risk_level": security["risk_level"],
            "signals": list(security["signals"]),
        },
    }
