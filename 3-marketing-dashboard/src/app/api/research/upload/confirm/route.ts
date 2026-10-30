import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { confirmUpload } from "@/server/services/research";

const schema = z.object({
  token: z.string().uuid(),
  textColumn: z.number().int().min(0).max(200),
  likesColumn: z.number().int().min(0).max(200).nullable(),
});

/** Step 2: columns chosen, write the comments file. */
export const POST = handle(async (request) => {
  const body = await readJson(request, schema);
  return json(confirmUpload(body.token, body.textColumn, body.likesColumn), { status: 201 });
});
