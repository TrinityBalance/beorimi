from .state import AnalysisState


def record_observation(
    state: AnalysisState, observation: dict
) -> AnalysisState:
    return {
        **state,
        "observation": observation,
        "evidence_path": [*state.get("evidence_path", []), "vlm"],
    }
