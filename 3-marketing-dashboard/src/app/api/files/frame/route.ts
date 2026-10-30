import fs from "node:fs";
import { handle } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { resolveFrame } from "@/server/services/filming";

/** Serves extracted video frames only (a strict path pattern), never arbitrary project files. */
export const GET = handle(async (request) => {
  const relative = new URL(request.url).searchParams.get("path") ?? "";
  const frame = resolveFrame(relative);
  if (!frame) throw new ServiceError(404, "الصورة غير موجودة");
  return new Response(fs.readFileSync(frame.absolute), {
    headers: { "Content-Type": frame.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
});
