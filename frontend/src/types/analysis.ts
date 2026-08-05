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

export type WasteCandidate = {
  name: string;
  confidence: number;
  fee: number;
  size: string;
};

export type WasteAnalysisResult = {
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
