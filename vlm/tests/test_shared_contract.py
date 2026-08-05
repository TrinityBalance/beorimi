import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from vlm.app.contracts import to_analysis_response, to_vlm_response
from vlm.tests.sample_observation import sample_observation

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SHARED_SCHEMA_PATH = REPOSITORY_ROOT / "shared" / "schemas" / "analysis-response.json"
VLM_RESULT_SCHEMA_PATH = (
    REPOSITORY_ROOT / "shared" / "schemas" / "vlm-analysis-result.json"
)


class SharedContractTests(unittest.TestCase):
    def test_api_mapping_matches_shared_analysis_response_schema(self) -> None:
        schema = json.loads(SHARED_SCHEMA_PATH.read_text(encoding="utf-8"))
        observation = sample_observation()
        observation["items"][0]["category"] = "unknown"
        observation["items"][0]["size_basis"] = "visible_label"
        observation["items"][0]["reference_object"] = "제품 규격 라벨"
        result = to_analysis_response(observation)

        Draft202012Validator(schema).validate(result)

    def test_internal_api_envelope_keeps_security_out_of_public_observation(self) -> None:
        observation = sample_observation()
        observation["security"] = {
            "prompt_injection_detected": True,
            "risk_level": "high",
            "signals": ["system_prompt_extraction"],
        }

        result = to_vlm_response(observation)

        public_schema = json.loads(SHARED_SCHEMA_PATH.read_text(encoding="utf-8"))
        result_schema = json.loads(VLM_RESULT_SCHEMA_PATH.read_text(encoding="utf-8"))
        registry = Registry().with_resource(
            "analysis-response.json",
            Resource.from_contents(public_schema),
        )
        Draft202012Validator(result_schema, registry=registry).validate(result)
        self.assertNotIn("security", result["observation"])
        self.assertEqual(result["guardrail"], observation["security"])

    def test_retake_message_is_preserved_for_frontend(self) -> None:
        observation = sample_observation()
        observation["status"] = "retake_required"
        observation["scene_type"] = "unclear"
        observation["image_quality"] = {
            "usable": False,
            "issues": ["blur"],
            "retake_required": True,
            "retake_message": "물건이 선명하게 보이도록 다시 촬영해주세요.",
        }
        observation["items"] = []
        observation["notes"] = ""

        result = to_analysis_response(observation)

        self.assertEqual(
            result["notes"],
            "물건이 선명하게 보이도록 다시 촬영해주세요.",
        )


if __name__ == "__main__":
    unittest.main()
