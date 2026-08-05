import { errorResponse, objectExists, parseImageKey, requireUser, serviceClient } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const imageKey = parseImageKey(await request.json(), user.id);
    if (!await objectExists(imageKey)) return Response.json({ detail: "Uploaded image was not found" }, { status: 404 });
    const { data, error } = await serviceClient().rpc("create_analysis_job", { p_owner: user.id, p_image_key: imageKey });
    if (error?.code === "P0001") return Response.json({ detail: error.message }, { status: 429 });
    if (error || !data) throw new Error(error?.message ?? "Analysis job was not created");
    return Response.json(data, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
