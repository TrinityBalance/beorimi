export type BoundingBox = [number, number, number, number];

export type AnalysisSceneType = "single_item" | "multi_item" | "unclear";

export type AnalysisCategory =
  | "furniture"
  | "appliance_large"
  | "appliance_small"
  | "bedding"
  | "container"
  | "packaging"
  | "textile"
  | "battery_lamp"
  | "other"
  | "unknown";

export type AnalysisMaterial =
  | "fabric"
  | "wood"
  | "metal"
  | "plastic"
  | "glass"
  | "paper"
  | "mixed"
  | "unknown";

export type BackendAnalysisItem = {
  id: number;
  label: string;
  category: AnalysisCategory;
  material: AnalysisMaterial;
  quantity: number;
  longest_side_cm: number | null;
  size_basis:
    | "reference_object"
    | "visible_label"
    | "typical_product"
    | "unknown";
  reference_object: string | null;
  condition: "intact" | "minor_damage" | "broken" | "unknown";
  contamination: "clean" | "residue" | "unknown";
  confidence: number;
  needs_user_confirmation: boolean;
  confirm_question: string | null;
  bbox: BoundingBox | null;
};

export type BackendAnalysisResponse = {
  scene_type: AnalysisSceneType;
  items: BackendAnalysisItem[];
  notes: string;
};

export type UploadUrlResponse = {
  upload_url: string;
  image_key: string;
  expires_in: number;
  form_fields: Record<string, string>;
};

export type AnalysisJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type AnalysisJob = {
  id: string;
  owner: string;
  image_key: string;
  status: AnalysisJobStatus;
  created_at: string;
  updated_at: string;
  item_name: string | null;
  fee: number | null;
  message: string | null;
  error_message: string | null;
  observation: BackendAnalysisResponse | null;
};
