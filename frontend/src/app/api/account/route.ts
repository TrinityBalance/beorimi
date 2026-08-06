import {
  errorResponse,
  requireUser,
  serviceClient,
  storageBucket,
} from "@/lib/server/supabase";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const client = serviceClient();
    const folder = `waste-images/${user.id}`;
    const { data: objects, error: listError } = await client.storage
      .from(storageBucket())
      .list(folder, { limit: 100 });
    if (listError) throw new Error(`Account image lookup failed: ${listError.message}`);

    if (objects.length > 0) {
      const { error: removeError } = await client.storage
        .from(storageBucket())
        .remove(objects.map((object) => `${folder}/${object.name}`));
      if (removeError) throw new Error(`Account image deletion failed: ${removeError.message}`);
    }

    const { error: deleteError } = await client.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Account deletion failed: ${deleteError.message}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
