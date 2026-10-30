import { handle, json } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { getIdeasView, listIdeaBatches } from "@/server/services/research";

/** No query = the list of analysed batches. `?file=` = one batch, parsed. */
export const GET = handle(async (request) => {
  const file = new URL(request.url).searchParams.get("file");
  if (!file) return json({ batches: listIdeaBatches() });
  try {
    return json(getIdeasView(file));
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(400, "مسار الملف غير صالح");
  }
});
