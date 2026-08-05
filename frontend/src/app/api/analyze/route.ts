import type {
  AnalyzeRouteResponse,
  BackendAnalysisResponse,
} from "@/types/analysis";
import { DEMO_WASTE_CATALOG } from "@/lib/demo-waste-catalog";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const DEMO_ANALYSIS_RESPONSE: AnalyzeRouteResponse = {
  scene_type: "multi_item",
  items: [
    {
      id: 1,
      label: "사무용 의자",
      confidence: 0.92,
      bbox: [430, 170, 720, 850],
    },
    {
      id: 2,
      label: "1인용 소파",
      confidence: 0.84,
      bbox: [40, 290, 350, 880],
    },
    {
      id: 3,
      label: "수납장",
      confidence: 0.73,
      bbox: [275, 90, 510, 900],
    },
  ],
  notes:
    "DEMO 모드의 임시 결과예요. 실제 Backend/VLM을 연결하면 사진 판독 결과로 교체됩니다.",
  demo: true,
  feeEstimates: {
    "1": 2000,
    "2": 3000,
    "3": 5000,
  },
  catalog: DEMO_WASTE_CATALOG,
};

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { message: "올바른 이미지 업로드 요청이 필요합니다." },
      { status: 400 },
    );
  }

  const image = formData.get("image");

  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return Response.json(
      { message: "분석할 이미지가 필요합니다." },
      { status: 400 },
    );
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return Response.json(
      { message: "이미지는 10MB 이하여야 합니다." },
      { status: 413 },
    );
  }

  if (isDemoModeEnabled()) {
    return Response.json(DEMO_ANALYSIS_RESPONSE, {
      headers: { "X-Beorimi-Demo": "true" },
    });
  }

  const upstreamFormData = new FormData();
  upstreamFormData.append("file", image, image.name);

  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/analysis`, {
      method: "POST",
      body: upstreamFormData,
      cache: "no-store",
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as
        | { detail?: string; message?: string }
        | null;
      return Response.json(
        {
          message:
            error?.detail ??
            error?.message ??
            "사진 분석 서버가 요청을 처리하지 못했어요.",
        },
        { status: response.status },
      );
    }

    const result = (await response.json()) as BackendAnalysisResponse;
    if (!isAnalysisResponse(result)) {
      return Response.json(
        { message: "사진 분석 결과의 형식이 올바르지 않아요." },
        { status: 502 },
      );
    }

    return Response.json(result);
  } catch {
    return Response.json(
      {
        message:
          "사진 분석 서버에 연결할 수 없어요. 백엔드 실행 상태를 확인해주세요.",
      },
      { status: 502 },
    );
  }
}

function isDemoModeEnabled() {
  const configured = process.env.ANALYSIS_DEMO_MODE;

  if (configured !== undefined) {
    return configured.toLowerCase() === "true";
  }

  return process.env.NODE_ENV === "development";
}

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

function isAnalysisResponse(value: unknown): value is BackendAnalysisResponse {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<BackendAnalysisResponse>;
  return (
    ["single_item", "multi_item", "unclear"].includes(result.scene_type ?? "") &&
    Array.isArray(result.items) &&
    result.items.every(
      (item) =>
        typeof item?.id === "number" &&
        typeof item.label === "string" &&
        item.label.trim().length > 0 &&
        typeof item.confidence === "number" &&
        item.confidence >= 0 &&
        item.confidence <= 1 &&
        (item.bbox === null ||
          (Array.isArray(item.bbox) &&
            item.bbox.length === 4 &&
            item.bbox.every(
              (coordinate) =>
                Number.isInteger(coordinate) &&
                coordinate >= 0 &&
                coordinate <= 1000,
            ) &&
            item.bbox[2] > item.bbox[0] &&
            item.bbox[3] > item.bbox[1])),
    ) &&
    typeof result.notes === "string"
  );
}
