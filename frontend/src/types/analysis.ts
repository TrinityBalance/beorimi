export type PendingPhoto = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
};

export type SelectionRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  | "other";

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
  size_basis: "reference_object" | "typical_product" | "unknown";
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

export type WasteSizeOption = {
  label: string;
  fee: number;
  guide?: string;
};

export type WasteCatalogItem = {
  name: string;
  sizes: WasteSizeOption[];
  sizeGuide?: string;
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

export type DetectedWasteItem = BackendAnalysisItem & {
  selected: boolean;
  estimatedFee?: number;
  detectedLabel?: string;
  quantity?: number;
  size?: string;
  userConfirmed?: boolean;
};

export type WasteCandidate = {
  name: string;
  confidence: number;
  fee: number;
  size: string;
};

export type LegacyWasteAnalysisResult = {
  id: string;
  createdAt: string;
  district: string;
  image: string;
  imageName: string;
  region: SelectionRegion | null;
  primary: WasteCandidate;
  candidates: WasteCandidate[];
  reportRequired: boolean;
  disposal: {
    summary: string;
    steps: string[];
    cautions: string[];
  };
  source: {
    label: string;
    url: string;
    checkedAt: string;
  };
  demo?: boolean;
};

export type MultiWasteAnalysisResult = {
  kind: "multi";
  id: string;
  createdAt: string;
  district: string;
  image: string;
  imageName: string;
  imageWidth: number;
  imageHeight: number;
  region: SelectionRegion | null;
  sceneType: AnalysisSceneType;
  items: DetectedWasteItem[];
  notes: string;
  demo?: boolean;
  catalog?: WasteCatalogItem[];
};

export type WasteAnalysisResult =
  | LegacyWasteAnalysisResult
  | MultiWasteAnalysisResult;
