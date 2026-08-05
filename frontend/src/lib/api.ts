import type {
  AnalysisJob,
  AnalysisJobStatus,
  BackendAnalysisResponse,
  UploadUrlResponse,
} from "@/types/analysis";

const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
  /\/$/,
  "",
);
const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof BackendApiError) throw error;
    throw new BackendApiError(
      "분석 서버에 연결할 수 없어요. 네트워크 상태를 확인해주세요.",
      0,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string; message?: string }
      | null;
    const knownStatus = [400, 401, 403, 404, 413, 422, 503].includes(
      response.status,
    );
    throw new BackendApiError(
      knownStatus
        ? messageForStatus(response.status)
        : body?.detail ?? body?.message ?? messageForStatus(response.status),
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export async function uploadAndStartAnalysis(
  image: Blob,
  filename: string,
  accessToken: string,
  options: {
    signal?: AbortSignal;
    onStatus?: (status: AnalysisJobStatus | "uploading") => void;
  } = {},
): Promise<AnalysisJob> {
  options.onStatus?.("uploading");
  const upload = await apiRequest<UploadUrlResponse>(
    "/api/uploads",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        filename,
        content_type: image.type,
        size_bytes: image.size,
      }),
      signal: options.signal,
    },
  );

  const form = new FormData();
  for (const [key, value] of Object.entries(upload.form_fields)) {
    form.append(key, value);
  }
  form.append("file", image, filename);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(upload.upload_url, {
      method: "POST",
      body: form,
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new BackendApiError(
      "사진 업로드에 실패했어요. 네트워크 상태를 확인해주세요.",
      0,
    );
  }

  if (!uploadResponse.ok) {
    throw new BackendApiError(
      "사진 업로드가 만료되었거나 허용된 크기를 초과했어요. 다시 시도해주세요.",
      uploadResponse.status,
    );
  }

  options.onStatus?.("queued");
  const job = await apiRequest<AnalysisJob>("/api/analyses", accessToken, {
    method: "POST",
    body: JSON.stringify({ image_key: upload.image_key }),
    signal: options.signal,
  });

  return pollAnalysis(job, accessToken, options);
}

async function pollAnalysis(
  initialJob: AnalysisJob,
  accessToken: string,
  options: {
    signal?: AbortSignal;
    onStatus?: (status: AnalysisJobStatus | "uploading") => void;
  },
): Promise<AnalysisJob> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let job = initialJob;

  while (job.status !== "completed" && job.status !== "failed") {
    options.onStatus?.(job.status);
    if (Date.now() >= deadline) {
      throw new BackendApiError(
        "분석이 예상보다 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.",
        408,
      );
    }

    await wait(POLL_INTERVAL_MS, options.signal);
    job = await apiRequest<AnalysisJob>(
      `/api/analyses/${encodeURIComponent(job.id)}`,
      accessToken,
      { signal: options.signal },
    );
  }

  options.onStatus?.(job.status);
  if (job.status === "failed") {
    throw new BackendApiError(
      job.error_message ?? "사진을 분석하지 못했어요. 다시 시도해주세요.",
      422,
    );
  }
  if (!job.observation || !isAnalysisResponse(job.observation)) {
    throw new BackendApiError("분석 결과 형식이 올바르지 않아요.", 502);
  }
  return job;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const handleAbort = () => {
      window.clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function isAnalysisResponse(value: unknown): value is BackendAnalysisResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<BackendAnalysisResponse>;

  return (
    ["single_item", "multi_item", "unclear"].includes(result.scene_type ?? "") &&
    Array.isArray(result.items) &&
    result.items.every(
      (item) =>
        Number.isInteger(item?.id) &&
        typeof item?.label === "string" &&
        typeof item?.category === "string" &&
        typeof item?.material === "string" &&
        Number.isInteger(item?.quantity) &&
        (item?.longest_side_cm === null ||
          Number.isInteger(item?.longest_side_cm)) &&
        typeof item?.size_basis === "string" &&
        (item?.reference_object === null ||
          typeof item?.reference_object === "string") &&
        typeof item?.condition === "string" &&
        typeof item?.contamination === "string" &&
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
                Number.isInteger(coordinate) && coordinate >= 0 && coordinate <= 1000,
            ))),
    ) &&
    typeof result.notes === "string"
  );
}

function messageForStatus(status: number): string {
  if (status === 400 || status === 413 || status === 422) {
    return "사진 형식이나 크기를 확인해주세요.";
  }
  if (status === 401 || status === 403) {
    return "로그인이 만료되었어요. 다시 로그인해주세요.";
  }
  if (status === 404) {
    return "업로드한 사진이나 분석 요청을 찾지 못했어요. 다시 시도해주세요.";
  }
  if (status === 503) {
    return "분석 서비스가 잠시 바빠요. 잠시 후 다시 시도해주세요.";
  }
  return "분석 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
}

function getApiBaseUrl(): string {
  if (CONFIGURED_API_BASE_URL) return CONFIGURED_API_BASE_URL;
  if (process.env.NODE_ENV === "development") return "http://localhost:8000";
  throw new BackendApiError(
    "분석 서버 연결 설정이 아직 완료되지 않았어요. 관리자에게 문의해주세요.",
    0,
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
