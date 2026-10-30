import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { startResearch } from "@/server/services/research";

const schema = z.object({ commentsFile: z.string().min(1).max(300) });

export const POST = handle(async (request) => {
  const { commentsFile } = await readJson(request, schema);
  return json({ run: startResearch(commentsFile) }, { status: 202 });
});
