import unittest

from jsonschema.exceptions import ValidationError

from vlm.app.schemas import structured_output_schema, validate_observation
from vlm.tests.sample_observation import sample_observation


class ObservationSchemaTests(unittest.TestCase):
    def test_valid_observation_is_accepted(self) -> None:
        observation = sample_observation()

        self.assertIs(validate_observation(observation), observation)

    def test_confidence_outside_range_is_rejected(self) -> None:
        observation = sample_observation()
        observation["items"][0]["confidence"] = 1.5

        with self.assertRaises(ValidationError):
            validate_observation(observation)

    def test_unknown_guardrail_signal_is_rejected(self) -> None:
        observation = sample_observation()
        observation["security"]["signals"] = ["free_form_attack_text"]

        with self.assertRaises(ValidationError):
            validate_observation(observation)

    def test_structured_output_schema_omits_document_metadata(self) -> None:
        schema = structured_output_schema()

        self.assertNotIn("$schema", schema)
        self.assertNotIn("$id", schema)
        self.assertNotIn("title", schema)
        self.assertFalse(schema["additionalProperties"])


if __name__ == "__main__":
    unittest.main()
