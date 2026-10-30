import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { parseStyleName, restoreSnapshot, setTrained } from "@/server/services/training";

const trainedSchema = z.object({ trained: z.boolean() });
const restoreSchema = z.object({ snapshotId: z.number().int().positive() });

export const POST = handle<RouteContext<"/api/style/[name]/[action]">>(async (request, context) => {
  const { name, action } = await context.params;
  const style = parseStyleName(name);
  switch (action) {
    case "trained":
      return json(setTrained(style, (await readJson(request, trainedSchema)).trained));
    case "restore":
      return json(restoreSnapshot(style, (await readJson(request, restoreSchema)).snapshotId));
    default:
      throw new ServiceError(404, "إجراء غير معروف");
  }
});
