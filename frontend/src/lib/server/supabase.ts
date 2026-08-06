import { createClient, type User } from "@supabase/supabase-js";
import { hasPrivacyConsent } from "@/lib/privacy-consent";
import { STORAGE_BUCKET } from "@/lib/supabase-config";

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function config(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is not configured`);
  return trimmed;
}

function supabaseUrl() { return config("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL); }
function publishableKey() { return config("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); }

export function storageBucket() {
  return STORAGE_BUCKET;
}

export function serviceClient() {
  return createClient(supabaseUrl(), config("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireUser(request: Request): Promise<User> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Authentication required");
  const client = createClient(supabaseUrl(), publishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Authentication required");
  return data.user;
}

export function requirePrivacyConsent(user: User) {
  if (!hasPrivacyConsent(user)) {
    throw new HttpError(403, "Privacy consent is required before uploading a photo");
  }
}

export function parseUploadPayload(payload: unknown): { filename: string; contentType: string; sizeBytes: number } {
  if (!payload || typeof payload !== "object") throw new HttpError(400, "Invalid upload request");
  const value = payload as Record<string, unknown>;
  const filename = typeof value.filename === "string" ? value.filename.trim() : "";
  const contentType = typeof value.content_type === "string" ? value.content_type : "";
  const sizeBytes = value.size_bytes;
  if (!filename || filename.length > 255 || !ALLOWED_CONTENT_TYPES.has(contentType) || !Number.isInteger(sizeBytes) || (sizeBytes as number) < 1 || (sizeBytes as number) > MAX_SOURCE_IMAGE_BYTES) {
    throw new HttpError(400, "Invalid image metadata");
  }
  return { filename, contentType, sizeBytes: sizeBytes as number };
}

export function imageKey(owner: string, contentType: string): string {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  return `waste-images/${owner}/${crypto.randomUUID()}.${extension}`;
}

export function parseImageKey(payload: unknown, owner: string): string {
  const imageKey = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).image_key === "string"
    ? (payload as Record<string, string>).image_key
    : "";
  if (!imageKey || imageKey.length > 1024 || !imageKey.startsWith(`waste-images/${owner}/`)) throw new HttpError(400, "Image key does not belong to the user");
  return imageKey;
}

export async function objectExists(key: string): Promise<boolean> {
  const slash = key.lastIndexOf("/");
  const { data, error } = await serviceClient().storage.from(storageBucket()).list(key.slice(0, slash), { search: key.slice(slash + 1), limit: 1 });
  if (error) throw new Error(`Storage lookup failed: ${error.message}`);
  return data.some((item) => item.name === key.slice(slash + 1));
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ detail: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ detail: "Service unavailable" }, { status: 503 });
}
