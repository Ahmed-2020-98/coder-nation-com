import { getRun } from "@/server/db";
import { handle, json } from "@/server/http";
import { cancelRun } from "@/server/jobs";
import { ServiceError } from "@/server/services/common";

export const POST = handle<RouteContext<"/api/runs/[id]/cancel">>(async (_request, context) => {
  const { id } = await context.params;
  if (!getRun(id)) throw new ServiceError(404, "التشغيل غير موجود");
  if (!cancelRun(id)) throw new ServiceError(409, "التشغيل خلص بالفعل");
  return json({ ok: true });
});
