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

export type BackendAnalysisItem = {
  id: number;
  label: string;
  confidence: number;
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

export type AnalyzeRouteResponse = BackendAnalysisResponse & {
  demo?: boolean;
  feeEstimates?: Record<string, number>;
  catalog?: WasteCatalogItem[];
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
