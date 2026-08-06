from typing import Any, Literal, TypedDict


class GuardrailDecision(TypedDict):
    allowed: bool
    risk_level: Literal["none", "low", "high"]
    signals: list[str]


class AnalysisState(TypedDict, total=False):
    candidate_observation: dict[str, Any]
    observation: dict[str, Any]
    guardrail: dict[str, Any]
    guardrail_decision: GuardrailDecision
    status: Literal["allowed", "blocked"]
    evidence_path: list[str]
    errors: list[str]
