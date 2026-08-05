import type {
  PendingPhoto,
  SelectionRegion,
  WasteAnalysisResult,
} from "@/types/analysis";

const PHOTO_KEY = "beorimi:pending-photo";
const REGION_KEY = "beorimi:selected-region";
const HISTORY_KEY = "beorimi:analysis-history";
const HISTORY_LIMIT = 6;

export function savePendingPhoto(photo: PendingPhoto) {
  sessionStorage.setItem(PHOTO_KEY, JSON.stringify(photo));
  sessionStorage.removeItem(REGION_KEY);
}

export function getPendingPhoto(): PendingPhoto | null {
  return readJson<PendingPhoto>(sessionStorage.getItem(PHOTO_KEY));
}

export function saveSelectedRegion(region: SelectionRegion | null) {
  if (!region) {
    sessionStorage.removeItem(REGION_KEY);
    return;
  }

  sessionStorage.setItem(REGION_KEY, JSON.stringify(region));
}

export function getSelectedRegion(): SelectionRegion | null {
  return readJson<SelectionRegion>(sessionStorage.getItem(REGION_KEY));
}

export function getHistory(): WasteAnalysisResult[] {
  return readJson<WasteAnalysisResult[]>(localStorage.getItem(HISTORY_KEY)) ?? [];
}

export function getResult(id: string): WasteAnalysisResult | null {
  return getHistory().find((result) => result.id === id) ?? null;
}

export function saveResult(result: WasteAnalysisResult) {
  const next = [
    result,
    ...getHistory().filter((item) => item.id !== result.id),
  ].slice(0, HISTORY_LIMIT);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    const withoutImages = next.map((item) => ({ ...item, image: "" }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(withoutImages));
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function readJson<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
