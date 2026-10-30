import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { createCardFromIdea, getBoard } from "@/server/services/cards";

export const GET = handle(async () => json({ cards: getBoard() }));

const createSchema = z.object({
  ideasFile: z.string().min(1).max(300),
  ideaNo: z.number().int().min(1).max(50),
  slug: z.string().min(3).max(60),
});

export const POST = handle(async (request) => {
  const body = await readJson(request, createSchema);
  return json({ card: createCardFromIdea(body) }, { status: 201 });
});
