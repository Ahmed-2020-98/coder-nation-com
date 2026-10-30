import "server-only";
import path from "node:path";

/**
 * Server-only configuration. Nothing in here is ever imported by client code, and neither the API key nor any
 * login token is ever read into this object (the SDK's local process picks its credentials up on its own).
 */
const root = process.cwd();

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * How the Agent SDK's local Claude Code process authenticates:
 *  - "api_key": ANTHROPIC_API_KEY (billed per token to the API account).
 *  - "subscription": the claude.ai login that `claude` already has on this machine (no key; counts against the plan's
 *    usage limits). Personal, local use only; see README for the terms caveat.
 * CLAUDE_AUTH forces one; otherwise a key in the environment wins and its absence means the subscription login.
 */
export type AuthMode = "subscription" | "api_key";

function authModeFromEnv(): AuthMode {
  const wanted = process.env.CLAUDE_AUTH;
  if (wanted === "subscription" || wanted === "api_key") return wanted;
  return process.env.ANTHROPIC_API_KEY ? "api_key" : "subscription";
}

const authMode = authModeFromEnv();

// AGENT_ROOT and DATA_DIR are chosen by the user at runtime on purpose, so Turbopack must not trace them at build time.
export const env = {
  authMode,
  /** The Marketing Agent project (CLAUDE.md, .claude/agents, marketing/). */
  agentRoot: path.resolve(/*turbopackIgnore: true*/ root, process.env.AGENT_ROOT ?? "../2-marketing-agent"),
  /** SQLite database + uploaded footage. */
  dataDir: path.resolve(/*turbopackIgnore: true*/ root, process.env.DATA_DIR ?? "data"),
  model: process.env.CLAUDE_MODEL ?? "sonnet",
  /** Reasoning effort for every run; undefined = the model's default. */
  effort: (["low", "medium", "high", "xhigh", "max"] as const).find((level) => level === process.env.RUN_EFFORT),
  runBudgetUsd: numberFromEnv("RUN_BUDGET_USD", 2),
  maxUploadBytes: numberFromEnv("MAX_UPLOAD_MB", 2048) * 1024 * 1024,
  // A subscription has shared usage limits, so one run at a time by default.
  maxConcurrentRuns: numberFromEnv("MAX_CONCURRENT_RUNS", authMode === "subscription" ? 1 : 2),
  /** Dev-only simulator so the UI can be exercised without spending API money. Never active in production. */
  fakeAgents: process.env.FAKE_AGENT_RUNS === "1" && process.env.NODE_ENV !== "production",
};
