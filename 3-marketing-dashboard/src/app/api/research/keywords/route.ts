import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { getKeywords, saveKeywords } from "@/server/services/research";

export const GET = handle(async () => json(getKeywords()));

const schema = z.object({
  keywords: z.array(z.string().max(120)).max(200),
  trends: z.array(z.string().max(400)).max(200),
});

export const PUT = handle(async (request) => json(saveKeywords(await readJson(request, schema))));
