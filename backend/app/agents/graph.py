from collections.abc import Callable

from .nodes import record_observation
from .state import AnalysisState

GraphNode = Callable[..., AnalysisState]

# AIDEV-TODO: analyze→classify→regulations→validate→fee→answer 순서로 조립하고,
#             저신뢰 결과는 checkpoint에서 사용자 확인을 기다린 뒤 classify로 재개한다.
ANALYSIS_NODES: tuple[GraphNode, ...] = (record_observation,)
