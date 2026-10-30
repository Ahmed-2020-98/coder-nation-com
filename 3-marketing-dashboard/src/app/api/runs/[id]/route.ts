import { getRun } from "@/server/db";
import { handle, json } from "@/server/http";
import { ServiceError } from "@/server/services/common";

export const GET = handle<RouteContext<"/api/runs/[id]">>(async (_request, context) => {
  const { id } = await context.params;
  const run = getRun(id);
  if (!run) throw new ServiceError(404, "التشغيل غير موجود");
  return json({ run });
});
