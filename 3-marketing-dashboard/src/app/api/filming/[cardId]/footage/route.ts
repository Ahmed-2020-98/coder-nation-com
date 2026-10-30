import { handle, json } from "@/server/http";
import { uploadFootage } from "@/server/services/filming";

/**
 * Raw upload (the browser sends the File as the request body, the name in `x-filename`) so the video is streamed
 * to disk and never held in memory. This route is excluded from proxy.ts (body buffering), so handle() guards it.
 */
export const POST = handle<RouteContext<"/api/filming/[cardId]/footage">>(async (request, context) => {
  const { cardId } = await context.params;
  const rawName = request.headers.get("x-filename") ?? "video.mp4";
  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    /* keep the raw header value */
  }
  const length = Number(request.headers.get("content-length"));
  const result = await uploadFootage(cardId, request.body, name, Number.isFinite(length) && length > 0 ? length : null);
  return json(result, { status: 201 });
});
