from collections.abc import Callable

from .nodes import record_observation
from .state import AnalysisState

GraphNode = Callable[..., AnalysisState]

# AIDEV-TODO: shared API 계약 확정 후 VLM→수수료 조회→RAG 노드를 LangGraph로 조립한다.
ANALYSIS_NODES: tuple[GraphNode, ...] = (record_observation,)
