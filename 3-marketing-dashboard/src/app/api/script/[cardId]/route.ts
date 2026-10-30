import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { getScriptView, saveScript } from "@/server/services/script";

export const GET = handle<RouteContext<"/api/script/[cardId]">>(async (_request, context) => {
  const { cardId } = await context.params;
  return json(getScriptView(cardId));
});

const schema = z.object({
  hook: z.string().max(5000),
  body: z.string().max(20000),
  cta: z.string().max(5000),
});

export const PUT = handle<RouteContext<"/api/script/[cardId]">>(async (request, context) => {
  const { cardId } = await context.params;
  return json(saveScript(cardId, await readJson(request, schema)));
});
