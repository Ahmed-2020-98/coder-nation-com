import { handle, json } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { diffVersions, parseStyleName } from "@/server/services/training";

/** `?from=<snapshotId>&to=<snapshotId|current>` */
export const GET = handle<RouteContext<"/api/style/[name]/diff">>(async (request, context) => {
  const { name } = await context.params;
  const params = new URL(request.url).searchParams;
  const from = Number(params.get("from"));
  const toRaw = params.get("to") ?? "current";
  const to = toRaw === "current" ? "current" : Number(toRaw);
  if (!Number.isInteger(from) || (to !== "current" && !Number.isInteger(to))) throw new ServiceError(400, "معاملات المقارنة غير صالحة");
  return json(diffVersions(parseStyleName(name), from, to));
});
