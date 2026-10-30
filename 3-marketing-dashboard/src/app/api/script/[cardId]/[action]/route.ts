import { z } from "zod";
import { handle, json, readJson } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { approveScript, pickVersion, saveAsExample, startScript, startScriptEdit } from "@/server/services/script";

const editSchema = z.object({ notes: z.string().min(3).max(2000) });
const approveSchema = z.object({ force: z.boolean().optional() });
const versionSchema = z.object({ file: z.string().min(1).max(300) });

export const POST = handle<RouteContext<"/api/script/[cardId]/[action]">>(async (request, context) => {
  const { cardId, action } = await context.params;
  switch (action) {
    case "generate":
      return json({ run: startScript(cardId) }, { status: 202 });
    case "edit":
      return json({ run: startScriptEdit(cardId, (await readJson(request, editSchema)).notes) }, { status: 202 });
    case "approve": {
      const { force } = await readJson(request, approveSchema);
      return json({ card: approveScript(cardId, Boolean(force)) });
    }
    case "example":
      return json(saveAsExample(cardId));
    case "version":
      return json(pickVersion(cardId, (await readJson(request, versionSchema)).file));
    default:
      throw new ServiceError(404, "إجراء غير معروف");
  }
});
