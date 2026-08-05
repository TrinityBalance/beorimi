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

export type DetectedWasteItem = BackendAnalysisItem & {
  selected: boolean;
  estimatedFee?: number;
  detectedLabel?: string;
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
import type {
  AnalysisSceneType,
  BackendAnalysisItem,
} from "./api";

export type {
  AnalysisCategory,
  AnalysisJob,
  AnalysisJobStatus,
  AnalysisMaterial,
  AnalysisSceneType,
  BackendAnalysisItem,
  BackendAnalysisResponse,
  BoundingBox,
  UploadUrlResponse,
} from "./api";
