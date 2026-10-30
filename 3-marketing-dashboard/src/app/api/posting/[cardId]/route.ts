import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { getPostingView, savePost } from "@/server/services/posting";

export const GET = handle<RouteContext<"/api/posting/[cardId]">>(async (_request, context) => {
  const { cardId } = await context.params;
  return json(getPostingView(cardId));
});

const tag = z.string().max(80);
const schema = z.object({
  caption: z.string().max(5000),
  keywordTags: z.array(tag).max(60),
  suggestedTags: z.array(tag).max(60),
  timing: z.string().max(1000),
});

export const PUT = handle<RouteContext<"/api/posting/[cardId]">>(async (request, context) => {
  const { cardId } = await context.params;
  return json(savePost(cardId, await readJson(request, schema)));
});
