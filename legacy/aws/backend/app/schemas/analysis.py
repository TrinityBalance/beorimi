from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class AnalysisCreateRequest(BaseModel):
    image_key: str = Field(min_length=1, max_length=1024)


BoundingCoordinate = Annotated[int, Field(ge=0, le=1000)]


class AnalysisObservationItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    id: int = Field(ge=1)
    label: str
    category: Literal[
        "furniture",
        "appliance_large",
        "appliance_small",
        "bedding",
        "container",
        "packaging",
        "textile",
        "battery_lamp",
        "other",
        "unknown",
    ]
    material: Literal[
        "fabric",
        "wood",
        "metal",
        "plastic",
        "glass",
        "paper",
        "mixed",
        "unknown",
    ]
    quantity: int = Field(ge=1)
    longest_side_cm: int | None = Field(default=None, ge=1)
    size_basis: Literal[
        "reference_object",
        "visible_label",
        "typical_product",
        "unknown",
    ]
    reference_object: str | None
    condition: Literal["intact", "minor_damage", "broken", "unknown"]
    contamination: Literal["clean", "residue", "unknown"]
    confidence: float = Field(ge=0, le=1)
    needs_user_confirmation: bool
    confirm_question: str | None
    bbox: Annotated[
        list[BoundingCoordinate],
        Field(min_length=4, max_length=4),
    ] | None


class AnalysisObservation(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    scene_type: Literal["single_item", "multi_item", "unclear"]
    items: list[AnalysisObservationItem]
    notes: str


class AnalysisRecord(BaseModel):
    id: str
    owner: str
    image_key: str
    status: Literal["queued", "processing", "completed", "failed"]
    created_at: str
    updated_at: str
    item_name: str | None = None
    fee: int | None = None
    message: str | None = None
    error_message: str | None = None
    observation: AnalysisObservation | None = None
