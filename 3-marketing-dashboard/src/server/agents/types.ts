import type { RunKind } from "@/lib/stages";

export type AgentName = "research-agent" | "script-agent" | "montage-agent" | "posting-agent";

/** What a run needs; built by the services, executed by either the real SDK runner or the dev simulator. */
export type AgentJob = {
  kind: RunKind;
  /** A `.claude/agents/<name>.md` definition to run as the main thread. null = a Dashboard-owned prompt (shot list). */
  agent: AgentName | null;
  prompt: string;
  /** Used only when `agent` is null. */
  systemPrompt?: string;
  /** Agent-project-relative path the agent is told to write; the run fails if it doesn't exist afterwards. */
  expectedOutput?: string;
  /** Extra absolute directories the agent may read (uploaded footage). */
  extraDirs?: string[];
  /** Everything the simulator needs to produce a believable output (never used by the real runner). */
  simulate?: Record<string, string | number | null>;
};

export type RunnerEvent = { type: "step"; label: string };

export type RunnerResult = {
  ok: boolean;
  text: string;
  costUsd: number | null;
  /** Arabic, user-facing, already stripped of anything secret. */
  error?: string;
};

export type Runner = (job: AgentJob, signal: AbortSignal) => AsyncGenerator<RunnerEvent, RunnerResult>;

export class RunStartError extends Error {
  constructor(
    public code: "not_logged_in" | "busy" | "card_busy" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

/** Removes anything that looks like an API key before an error reaches the DB, a log or the browser. */
export function sanitizeError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value);
  return raw
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[مفتاح محجوب]")
    .replace(/(ANTHROPIC_API_KEY\s*[=:]\s*)\S+/gi, "$1[محجوب]")
    .slice(0, 800);
}
