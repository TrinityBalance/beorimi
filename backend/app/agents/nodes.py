from .state import AnalysisState

PROMPT_INJECTION_BLOCK_MESSAGE = (
    "Image contains instruction-like text and cannot be safely analyzed"
)
SUSPICIOUS_OUTPUT_PHRASES = (
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "system prompt",
    "developer message",
    "reveal your prompt",
    "print your prompt",
    "api key",
    "secret key",
    "call a tool",
    "execute a command",
    "이전 지시",
    "앞선 지시",
    "지시를 무시",
    "시스템 프롬프트",
    "개발자 메시지",
    "프롬프트를 공개",
    "api 키",
    "비밀 키",
    "도구를 호출",
    "명령을 실행",
)


def _contains_suspicious_output(value: object) -> bool:
    if isinstance(value, str):
        normalized = value.casefold()
        return any(phrase in normalized for phrase in SUSPICIOUS_OUTPUT_PHRASES)
    if isinstance(value, dict):
        return any(_contains_suspicious_output(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_suspicious_output(item) for item in value)
    return False


def inspect_prompt_injection(state: AnalysisState) -> AnalysisState:
    assessment = state.get("guardrail", {})
    risk_level = assessment.get("risk_level", "high")
    raw_signals = assessment.get("signals", [])
    signals = [str(signal) for signal in raw_signals]
    detected = assessment.get("prompt_injection_detected") is True
    metadata_is_clean = not detected and risk_level == "none" and not signals

    if not metadata_is_clean and not detected:
        signals.append("inconsistent_guardrail_metadata")
    if _contains_suspicious_output(state.get("candidate_observation", {})):
        signals.append("suspicious_output_text")

    signals = list(dict.fromkeys(signals))
    allowed = metadata_is_clean and not signals
    effective_risk = "none" if allowed else risk_level
    if effective_risk not in {"none", "low", "high"} or (
        not allowed and effective_risk == "none"
    ):
        effective_risk = "high"

    return {
        "guardrail_decision": {
            "allowed": allowed,
            "risk_level": effective_risk,
            "signals": signals,
        },
        "evidence_path": [
            *state.get("evidence_path", []),
            "prompt_injection_guardrail",
        ],
    }


def record_observation(state: AnalysisState) -> AnalysisState:
    return {
        "observation": state["candidate_observation"],
        "evidence_path": [*state.get("evidence_path", []), "vlm"],
        "status": "allowed",
    }


def block_observation(_state: AnalysisState) -> AnalysisState:
    return {
        "status": "blocked",
        "errors": [PROMPT_INJECTION_BLOCK_MESSAGE],
    }
