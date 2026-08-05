import type { AnalysisJob, AnalysisJobStatus, UploadUrlResponse } from "@/types/api";
import { isAnalysisResponse } from "@/lib/analysis-contract";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000;

export class BackendApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function apiRequest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${CONFIGURED_API_BASE_URL ?? ""}${path}`, { ...init, headers, cache: "no-store" });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new BackendApiError("분석 서버에 연결할 수 없어요.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string; message?: string } | null;
    throw new BackendApiError(body?.detail ?? body?.message ?? messageForStatus(response.status), response.status);
  }
  return response.json() as Promise<T>;
}

export async function uploadAndStartAnalysis(image: Blob, filename: string, accessToken: string, options: { signal?: AbortSignal; onStatus?: (status: AnalysisJobStatus | "uploading") => void } = {}): Promise<AnalysisJob> {
  options.onStatus?.("uploading");
  const upload = await apiRequest<UploadUrlResponse>("/api/uploads", accessToken, {
    method: "POST",
    body: JSON.stringify({ filename, content_type: image.type, size_bytes: image.size }),
    signal: options.signal,
  });

  const { error: uploadError } = await getSupabaseBrowserClient().storage
    .from(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "waste-images")
    .uploadToSignedUrl(upload.image_key, upload.upload_token, image, { contentType: image.type });
  if (uploadError) throw new BackendApiError("사진 업로드에 실패했어요. 다시 시도해줘.", 0);

  options.onStatus?.("queued");
  const job = await apiRequest<AnalysisJob>("/api/analyses", accessToken, {
    method: "POST",
    body: JSON.stringify({ image_key: upload.image_key }),
    signal: options.signal,
  });
  return pollAnalysis(job, accessToken, options);
}

async function pollAnalysis(initialJob: AnalysisJob, accessToken: string, options: { signal?: AbortSignal; onStatus?: (status: AnalysisJobStatus | "uploading") => void }): Promise<AnalysisJob> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let job = initialJob;
  while (job.status !== "completed" && job.status !== "failed") {
    options.onStatus?.(job.status);
    if (Date.now() >= deadline) throw new BackendApiError("분석이 오래 걸리고 있어요. 잠시 뒤 다시 시도해줘.", 408);
    await wait(POLL_INTERVAL_MS, options.signal);
    job = await apiRequest<AnalysisJob>(`/api/analyses/${encodeURIComponent(job.id)}`, accessToken, { signal: options.signal });
  }
  options.onStatus?.(job.status);
  if (job.status === "failed") throw new BackendApiError(job.error_message ?? "사진을 분석하지 못했어요. 다시 시도해줘.", 422);
  if (!job.observation || !isAnalysisResponse(job.observation)) throw new BackendApiError("분석 결과 형식이 올바르지 않아요.", 502);
  return job;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => { window.clearTimeout(timeout); reject(signal.reason ?? new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

function messageForStatus(status: number): string {
  if ([400, 413, 422].includes(status)) return "사진 형식이나 크기를 확인해줘.";
  if ([401, 403].includes(status)) return "로그인이 만료됐어요. 다시 로그인해줘.";
  if (status === 404) return "업로드한 사진이나 분석 요청을 찾지 못했어요.";
  if (status === 429) return "이 계정의 사진 분석 5회를 모두 사용했어요.";
  if (status === 503) return "분석 서비스가 잠시 바빠요. 잠시 뒤 다시 시도해줘.";
  return "분석 요청을 처리하지 못했어요.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
