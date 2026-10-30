"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/server/db";

const FINAL = ["succeeded", "failed", "cancelled"];
export const isFinalStatus = (status: string): boolean => FINAL.includes(status);

/**
 * Follows a run: server-sent events for live steps, with a 2-second polling fallback if the stream drops.
 * Returns null until the first snapshot arrives (or when there is no run to follow).
 */
export function useRun(runId: string | null): Run | null {
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    const startPolling = () => {
      if (poll || stopped) return;
      poll = setInterval(async () => {
        try {
          const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
          const data = (await response.json()) as { run?: Run };
          if (data.run && !stopped) {
            setRun(data.run);
            if (isFinalStatus(data.run.status)) clearInterval(poll);
          }
        } catch {
          /* keep trying */
        }
      }, 2000);
    };

    const source = new EventSource(`/api/runs/${runId}/events`);
    source.addEventListener("snapshot", (event) => !stopped && setRun(JSON.parse((event as MessageEvent).data) as Run));
    source.addEventListener("step", (event) => {
      if (stopped) return;
      const step = JSON.parse((event as MessageEvent).data) as Run["steps"][number];
      setRun((current) => (current && current.id === runId ? { ...current, status: "running", steps: [...current.steps, step] } : current));
    });
    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as Run | null;
      if (data && !stopped) setRun(data);
      source.close();
    });
    source.onerror = () => {
      source.close();
      startPolling();
    };

    return () => {
      stopped = true;
      source.close();
      if (poll) clearInterval(poll);
    };
  }, [runId]);

  return runId && run?.id === runId ? run : null;
}
