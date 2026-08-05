import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

VLM_ROOT = Path(__file__).resolve().parents[1]
OBSERVATION_SCHEMA_PATH = VLM_ROOT / "schemas" / "observation-response.json"


def _load_schema() -> dict:
    return json.loads(OBSERVATION_SCHEMA_PATH.read_text(encoding="utf-8"))


SCHEMA = _load_schema()
VALIDATOR = Draft202012Validator(SCHEMA)


def structured_output_schema() -> dict:
    schema = copy.deepcopy(SCHEMA)
    for metadata_key in ("$schema", "$id", "title"):
        schema.pop(metadata_key, None)
    return schema


def validate_observation(observation: dict) -> dict:
    errors = sorted(VALIDATOR.iter_errors(observation), key=lambda error: list(error.path))
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.path) or "response"
        raise ValidationError(f"{location}: {first.message}")
    return observation
