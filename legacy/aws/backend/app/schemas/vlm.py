from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .analysis import AnalysisObservation

GuardrailSignal = Literal[
    "instruction_like_text",
    "system_prompt_extraction",
    "schema_manipulation",
    "tool_or_action_request",
    "credential_or_secret_request",
    "policy_bypass_request",
]


class VlmGuardrailAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    prompt_injection_detected: bool
    risk_level: Literal["none", "low", "high"]
    signals: list[GuardrailSignal] = Field(max_length=6)


class VlmAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    observation: AnalysisObservation
    guardrail: VlmGuardrailAssessment
