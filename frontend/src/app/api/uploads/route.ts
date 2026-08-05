import { errorResponse, imageKey, parseUploadPayload, requireUser, serviceClient, storageBucket } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const payload = parseUploadPayload(await request.json());
    const key = imageKey(user.id, payload.contentType);
    const { data, error } = await serviceClient().storage.from(storageBucket()).createSignedUploadUrl(key);
    if (error || !data?.token) throw new Error(error?.message ?? "Storage upload token was not created");
    return Response.json({ image_key: key, upload_token: data.token });
  } catch (error) {
    return errorResponse(error);
  }
}
