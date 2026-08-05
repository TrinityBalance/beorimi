import type {
  AnalysisCategory,
  AnalysisMaterial,
  BackendAnalysisResponse,
} from "@/types/api";

const SCENE_TYPES = new Set(["single_item", "multi_item", "unclear"]);
const CATEGORIES = new Set<AnalysisCategory>([
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
]);
const MATERIALS = new Set<AnalysisMaterial>([
  "fabric",
  "wood",
  "metal",
  "plastic",
  "glass",
  "paper",
  "mixed",
  "unknown",
]);
const SIZE_BASES = new Set([
  "reference_object",
  "visible_label",
  "typical_product",
  "unknown",
]);
const CONDITIONS = new Set(["intact", "minor_damage", "broken", "unknown"]);
const CONTAMINATION_LEVELS = new Set(["clean", "residue", "unknown"]);

export function isAnalysisResponse(
  value: unknown,
): value is BackendAnalysisResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<BackendAnalysisResponse>;

  return (
    SCENE_TYPES.has(result.scene_type ?? "") &&
    Array.isArray(result.items) &&
    result.items.every(
      (item) =>
        Number.isInteger(item?.id) &&
        item.id >= 1 &&
        typeof item?.label === "string" &&
        CATEGORIES.has(item?.category) &&
        MATERIALS.has(item?.material) &&
        Number.isInteger(item?.quantity) &&
        item.quantity >= 1 &&
        (item?.longest_side_cm === null ||
          (Number.isInteger(item?.longest_side_cm) &&
            item.longest_side_cm >= 1)) &&
        SIZE_BASES.has(item?.size_basis) &&
        (item?.reference_object === null ||
          typeof item?.reference_object === "string") &&
        CONDITIONS.has(item?.condition) &&
        CONTAMINATION_LEVELS.has(item?.contamination) &&
        typeof item?.confidence === "number" &&
        item.confidence >= 0 &&
        item.confidence <= 1 &&
        typeof item?.needs_user_confirmation === "boolean" &&
        (item?.confirm_question === null ||
          typeof item?.confirm_question === "string") &&
        (item.bbox === null ||
          (Array.isArray(item.bbox) &&
            item.bbox.length === 4 &&
            item.bbox.every(
              (coordinate) =>
                Number.isInteger(coordinate) &&
                coordinate >= 0 &&
                coordinate <= 1000,
            ))) &&
        (item.estimated_fee === undefined ||
          item.estimated_fee === null ||
          (Number.isInteger(item.estimated_fee) && item.estimated_fee >= 0)) &&
        (item.fee_size_label === undefined ||
          item.fee_size_label === null ||
          typeof item.fee_size_label === "string"),
    ) &&
    typeof result.notes === "string"
  );
}
