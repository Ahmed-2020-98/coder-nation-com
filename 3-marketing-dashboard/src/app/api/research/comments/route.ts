import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { listCommentFiles, savePastedComments } from "@/server/services/research";

export const GET = handle(async () => json({ files: listCommentFiles() }));

const schema = z.object({ text: z.string().min(1).max(2_000_000) });

/** Pasted comments (one per line) become marketing/inputs/comments-YYYY-MM-DD.txt. */
export const POST = handle(async (request) => {
  const { text } = await readJson(request, schema);
  return json(savePastedComments(text), { status: 201 });
});
