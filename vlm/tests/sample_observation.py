def sample_observation() -> dict:
    return {
        "schema_version": "1.0",
        "status": "success",
        "scene_type": "single_item",
        "image_quality": {
            "usable": True,
            "issues": [],
            "retake_required": False,
            "retake_message": None,
        },
        "items": [
            {
                "id": 1,
                "label": "소파",
                "category": "furniture",
                "alternatives": [],
                "material": "fabric",
                "quantity": 1,
                "condition": "intact",
                "contamination": "clean",
                "estimated_longest_side_cm": None,
                "size_basis": "unknown",
                "reference_object": None,
                "measurement_required": True,
                "confidence": 0.88,
                "confidence_tier": "high",
                "needs_user_confirmation": True,
                "confirm_question": "3인용 이상 소파가 맞나요?",
                "bbox": [100, 200, 900, 900],
                "visual_evidence": ["등받이와 좌석이 연결된 가구 형태"],
            }
        ],
        "notes": "",
    }
