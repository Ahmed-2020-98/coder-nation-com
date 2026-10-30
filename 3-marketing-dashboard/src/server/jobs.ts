import "server-only";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { env } from "./env";
import { activeRunFor, countActiveRuns, createRun, getRun, isOutputClaimed, updateRun, type Run } from "./db";
import { agentPath, toAgentRelative } from "./paths";
import { RunStartError, sanitizeError, type AgentJob, type Runner } from "./agents/types";
import { runAgent } from "./agents";
import { knownAuth } from "./agents/auth";
import { NOT_LOGGED_IN } from "./agents/failures";
import type { RunKind, RunStep } from "@/lib/stages";

/**
 * Background runs. A run is a DB row + an in-memory emitter: the HTTP request that starts it returns immediately,
 * the browser follows progress over SSE (or polls the row), and nothing depends on the page staying open.
 */

type Live = { emitter: EventEmitter; abort: AbortController; finished: boolean };

declare global {
  var __dashboardLive: Map<string, Live> | undefined;
}
const live = (): Map<string, Live> => (globalThis.__dashboardLive ??= new Map());

const OUTPUT_DIR: Partial<Record<RunKind, string>> = {
  research: "marketing/outputs/ideas",
  script: "marketing/outputs/scripts",
  script_edit: "marketing/outputs/scripts",
  montage: "marketing/outputs/montage",
  posting: "marketing/outputs/posts",
};

export type RunContext = { run: Run; resultText: string; outputFile: string | null };

export type StartOptions = {
  cardId: string | null;
  job: AgentJob;
  label?: string;
  /** Runs after the agent finished and its output file was found; throw to turn the run into a failure. */
  onSuccess?: (context: RunContext) => Promise<void> | void;
  /** Test seam: swap the runner. */
  runner?: Runner;
};

/**
 * Newest markdown file in `dir` written since this run started (fallback when the agent chose another file name).
 * A file already attributed to another run is never taken, so parallel runs can't steal each other's output.
 */
function newestSince(dir: string, sinceMs: number): string | null {
  if (!fs.existsSync(dir)) return null;
  let best: { relative: string; mtime: number } | null = null;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(dir, name);
    const mtime = fs.statSync(file).mtimeMs;
    const relative = toAgentRelative(file);
    if (mtime >= sinceMs - 50 && !isOutputClaimed(relative) && (!best || mtime > best.mtime)) best = { relative, mtime };
  }
  return best ? best.relative : null;
}

export function startRun(options: StartOptions): Run {
  // Synchronous on purpose: it uses the last known sign-in state (refreshed by every page's health check). When the
  // state is unknown the run is allowed and the SDK itself reports any real authentication problem.
  if (!env.fakeAgents && knownAuth()?.method === "none") {
    throw new RunStartError("not_logged_in", NOT_LOGGED_IN);
  }
  if (countActiveRuns() >= env.maxConcurrentRuns) {
    throw new RunStartError("busy", "فيه تشغيلات كتير شغّالة دلوقتي، استنى لحد ما واحد يخلص.");
  }
  if (activeRunFor(options.cardId)) {
    throw new RunStartError("card_busy", options.cardId ? "فيه تشغيل شغّال على الكارت ده بالفعل." : "فيه تحليل شغّال بالفعل.");
  }

  const run = createRun({ cardId: options.cardId, kind: options.job.kind, label: options.label });
  const handle: Live = { emitter: new EventEmitter(), abort: new AbortController(), finished: false };
  live().set(run.id, handle);
  void execute(run, options, handle);
  return run;
}

async function execute(initial: Run, options: StartOptions, handle: Live): Promise<void> {
  const steps: RunStep[] = [];
  const runner = options.runner ?? runAgent;
  const startedAt = Date.now();
  updateRun(initial.id, { status: "running" });
  handle.emitter.emit("status", "running");

  const pushStep = (label: string) => {
    const step: RunStep = { at: new Date().toISOString(), label };
    steps.push(step);
    if (steps.length > 300) steps.splice(0, steps.length - 300);
    updateRun(initial.id, { steps });
    handle.emitter.emit("step", step);
  };

  try {
    pushStep("بدء التشغيل");
    const generator = runner(options.job, handle.abort.signal);
    let next = await generator.next();
    while (!next.done) {
      pushStep(next.value.label);
      next = await generator.next();
    }
    const result = next.value;

    if (handle.abort.signal.aborted) {
      updateRun(initial.id, { status: "cancelled", endedAt: new Date().toISOString(), costUsd: result.costUsd });
      return;
    }
    if (!result.ok) {
      updateRun(initial.id, {
        status: "failed",
        endedAt: new Date().toISOString(),
        costUsd: result.costUsd,
        error: result.error ?? "فشل التشغيل",
      });
      return;
    }

    let outputFile: string | null = null;
    const expected = options.job.expectedOutput;
    if (expected) {
      if (fs.existsSync(agentPath(expected))) {
        outputFile = expected;
      } else {
        const dir = OUTPUT_DIR[options.job.kind];
        outputFile = dir ? newestSince(agentPath(dir), startedAt) : null;
      }
      if (!outputFile) {
        updateRun(initial.id, {
          status: "failed",
          endedAt: new Date().toISOString(),
          costUsd: result.costUsd,
          // The agent's last message usually says why (a refused command, a missing file), so show the start of it.
          error: `الـ Agent خلّص لكنه لم ينتج ملف المخرجات المتوقع.${result.text.trim() ? ` رده الأخير: «${sanitizeError(result.text.trim()).slice(0, 300)}»` : ""}`,
        });
        return;
      }
    }

    pushStep("حفظ النتيجة");
    const current = getRun(initial.id)!;
    await options.onSuccess?.({ run: current, resultText: result.text, outputFile });
    updateRun(initial.id, { status: "succeeded", endedAt: new Date().toISOString(), costUsd: result.costUsd, outputFile });
  } catch (error) {
    updateRun(initial.id, {
      status: handle.abort.signal.aborted ? "cancelled" : "failed",
      endedAt: new Date().toISOString(),
      error: sanitizeError(error),
    });
  } finally {
    handle.finished = true;
    handle.emitter.emit("done");
    // keep the handle briefly so late SSE subscribers still get the final event
    setTimeout(() => live().delete(initial.id), 30_000).unref?.();
  }
}

export function cancelRun(id: string): boolean {
  const handle = live().get(id);
  if (!handle || handle.finished) return false;
  handle.abort.abort();
  return true;
}

/** Subscribes to a live run. Returns null when the run isn't live in this process (already finished). */
export function subscribe(
  id: string,
  listener: { onStep: (step: RunStep) => void; onDone: () => void },
): (() => void) | null {
  const handle = live().get(id);
  if (!handle) return null;
  handle.emitter.on("step", listener.onStep);
  handle.emitter.on("done", listener.onDone);
  return () => {
    handle.emitter.off("step", listener.onStep);
    handle.emitter.off("done", listener.onDone);
  };
}
