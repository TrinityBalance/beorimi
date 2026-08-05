from typing import Any, Literal

from langgraph.graph import END, START, StateGraph

from .nodes import (
    PROMPT_INJECTION_BLOCK_MESSAGE,
    block_observation,
    inspect_prompt_injection,
    record_observation,
)
from .state import AnalysisState


def _route_guardrail(state: AnalysisState) -> Literal["allow", "block"]:
    return "allow" if state["guardrail_decision"]["allowed"] else "block"


def _build_guardrail_graph():
    builder = StateGraph(AnalysisState)
    builder.add_node("inspect_prompt_injection", inspect_prompt_injection)
    builder.add_node("record_observation", record_observation)
    builder.add_node("block_observation", block_observation)
    builder.add_edge(START, "inspect_prompt_injection")
    builder.add_conditional_edges(
        "inspect_prompt_injection",
        _route_guardrail,
        {
            "allow": "record_observation",
            "block": "block_observation",
        },
    )
    builder.add_edge("record_observation", END)
    builder.add_edge("block_observation", END)
    return builder.compile()


ANALYSIS_GUARDRAIL_GRAPH = _build_guardrail_graph()
def evaluate_vlm_result(
    observation: dict[str, Any],
    guardrail: dict[str, Any],
) -> AnalysisState:
    return ANALYSIS_GUARDRAIL_GRAPH.invoke(
        {
            "candidate_observation": observation,
            "guardrail": guardrail,
            "evidence_path": [],
            "errors": [],
        }
    )


# AIDEV-TODO: 현재 구현된 이미지 인젝션 가드 뒤에 classify→regulations→validate→fee→answer를
#             조립하고, 저신뢰 결과는 checkpoint에서 사용자 확인 후 classify로 재개한다.
