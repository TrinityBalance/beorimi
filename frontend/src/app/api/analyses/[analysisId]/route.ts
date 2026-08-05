import { errorResponse, requireUser, serviceClient } from "@/lib/server/supabase";

export async function GET(request: Request, context: { params: Promise<{ analysisId: string }> }) {
  try {
    const user = await requireUser(request);
    const { analysisId } = await context.params;
    const { data, error } = await serviceClient().from("analyses").select("*").eq("id", analysisId).eq("owner", user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return Response.json({ detail: "Analysis was not found" }, { status: 404 });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
