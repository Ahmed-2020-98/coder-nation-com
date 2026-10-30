import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { getStyleView, parseStyleName, saveStyle } from "@/server/services/training";

export const GET = handle<RouteContext<"/api/style/[name]">>(async (_request, context) => {
  const { name } = await context.params;
  return json(getStyleView(parseStyleName(name)));
});

const schema = z.object({ content: z.string().min(1).max(200_000), note: z.string().max(500).nullable().optional() });

export const PUT = handle<RouteContext<"/api/style/[name]">>(async (request, context) => {
  const { name } = await context.params;
  const body = await readJson(request, schema);
  return json(saveStyle(parseStyleName(name), body.content, body.note ?? null));
});
