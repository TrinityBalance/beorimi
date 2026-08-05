from typing import Any, TypedDict


class AnalysisState(TypedDict, total=False):
    image_name: str
    observation: dict[str, Any]
    waste_match: dict[str, Any]
    answer: str
    evidence_path: list[str]
    errors: list[str]
