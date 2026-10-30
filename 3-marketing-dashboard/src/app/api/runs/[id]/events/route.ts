import { getRun, type Run } from "@/server/db";
import { handle } from "@/server/http";
import { subscribe } from "@/server/jobs";
import { ServiceError } from "@/server/services/common";

// Server-Sent Events: replays what already happened, then streams new steps until the run ends.
export const dynamic = "force-dynamic";

const finished = (run: Run) => run.status === "succeeded" || run.status === "failed" || run.status === "cancelled";

export const GET = handle<RouteContext<"/api/runs/[id]/events">>(async (request, context) => {
  const { id } = await context.params;
  const initial = getRun(id);
  if (!initial) throw new ServiceError(404, "التشغيل غير موجود");

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };

      send("snapshot", initial);
      if (finished(initial)) {
        send("done", initial);
        close();
        return;
      }

      const unsubscribe = subscribe(id, {
        onStep: (step) => send("step", step),
        onDone: () => {
          send("done", getRun(id));
          close();
        },
      });
      const heartbeat = setInterval(() => !closed && controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe?.();
      };
      request.signal.addEventListener("abort", close);

      // The run may have ended between the first read and the subscription (or live in another process).
      const latest = getRun(id);
      if (!unsubscribe || (latest && finished(latest))) {
        send("done", latest);
        close();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
  });
});
