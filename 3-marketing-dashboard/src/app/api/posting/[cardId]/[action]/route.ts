import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { markPublished, markReady, setSchedule, startPosting } from "@/server/services/posting";

const generateSchema = z.object({ finalVideoPath: z.string().max(500).nullable().optional() });
const publishedSchema = z.object({ url: z.string().max(500).nullable().optional() });
const scheduleSchema = z.object({ scheduledAt: z.string().max(40).nullable() });

export const POST = handle<RouteContext<"/api/posting/[cardId]/[action]">>(async (request, context) => {
  const { cardId, action } = await context.params;
  switch (action) {
    case "generate": {
      const body = await readJson(request, generateSchema);
      return json({ run: startPosting(cardId, body.finalVideoPath ?? null) }, { status: 202 });
    }
    case "ready":
      return json({ card: markReady(cardId) });
    case "published": {
      const body = await readJson(request, publishedSchema);
      return json({ card: markPublished(cardId, body.url ?? null) });
    }
    case "schedule":
      return json({ card: setSchedule(cardId, (await readJson(request, scheduleSchema)).scheduledAt) });
    default:
      throw new ServiceError(404, "إجراء غير معروف");
  }
});
