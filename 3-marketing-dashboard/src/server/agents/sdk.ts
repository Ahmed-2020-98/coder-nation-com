import "server-only";
import fs from "node:fs";
import path from "node:path";
import { query, type Options, type SDKMessage, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { env } from "../env";
import { sanitizeError, type AgentJob, type Runner, type RunnerResult } from "./types";
import { permissionsFor } from "./permissions";
import { childEnv, invalidateAuth, NO_MCP } from "./auth";
import { budgetMessage, failureFor, looksLikeAuthProblem } from "./failures";

/** Turns a tool call into a short Arabic line for the progress list. Never includes commands or file contents. */
export function describeTool(name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  const file = typeof args.file_path === "string" ? path.basename(args.file_path) : typeof args.path === "string" ? path.basename(args.path) : "";
  switch (name) {
    case "Read":
      return file ? `قراءة ${file}` : "قراءة ملف";
    case "Glob":
      return "استكشاف الملفات";
    case "Grep":
      return "بحث / عدّ داخل الملفات";
    case "Edit":
    case "Write":
      return file ? `كتابة ${file}` : "كتابة ملف";
    case "WebSearch":
      return typeof args.query === "string" ? `بحث ويب: ${args.query.slice(0, 60)}` : "بحث ويب";
    case "WebFetch": {
      try {
        return `فتح صفحة: ${new URL(String(args.url)).hostname}`;
      } catch {
        return "فتح صفحة ويب";
      }
    }
    case "Bash": {
      const command = String(args.command ?? "");
      if (/ffprobe/.test(command)) return "قراءة معلومات الفيديو (ffprobe)";
      if (/silencedetect/.test(command)) return "كشف السكتات في الصوت";
      if (/scene/.test(command)) return "كشف نقاط القطع";
      if (/fps=|frames:v/.test(command)) return "استخراج فريمات من الفيديو";
      if (/ffmpeg/.test(command)) return "تشغيل ffmpeg";
      if (/mkdir/.test(command)) return "تجهيز مجلد الفريمات";
      return "تنفيذ أمر";
    }
    case "Agent":
    case "Task":
      return "تشغيل agent فرعي";
    default:
      return name;
  }
}

function stepsOf(message: SDKMessage): string[] {
  if (message.type === "system" && message.subtype === "init") {
    const agents = message.agents?.length ? ` (${message.agents.length} agents متاحة)` : "";
    return [`تم تحميل المشروع${agents}`];
  }
  if (message.type === "assistant") {
    const blocks = Array.isArray(message.message.content) ? message.message.content : [];
    return blocks.flatMap((block) => (block.type === "tool_use" ? [describeTool(block.name, block.input)] : []));
  }
  if (message.type === "auth_status" && message.error) return ["مشكلة في تسجيل الدخول"];
  return [];
}

/** The project root as configured and as it resolves on disk (they differ on macOS: /var vs /private/var). */
function projectRoots(): string[] {
  const roots = [env.agentRoot];
  try {
    roots.push(fs.realpathSync(env.agentRoot));
  } catch {
    /* the root does not exist yet: the run fails on its own with a clear error */
  }
  return roots;
}

const compact = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** What a denied tool call looked like, short enough for the progress list (no file contents). */
function deniedLabel(name: string, input: Record<string, unknown>): string {
  if (name === "Bash") return `Bash: ${String(input.command ?? "").replace(/\s+/g, " ").slice(0, 90)}`;
  const file = typeof input.file_path === "string" ? path.basename(input.file_path) : "";
  return file ? `${name}: ${file}` : name;
}

/**
 * Lines shown after a run: what it consumed (tokens, thinking, cache), and every tool call the permission rules
 * refused. Without these a failed run only says "finished without output" and a surprising bill has no explanation.
 */
export function resultDetails(message: SDKResultMessage): string[] {
  const lines: string[] = [];
  for (const [model, u] of Object.entries(message.modelUsage ?? {})) {
    const thinking = u.thinkingTokens ? ` (تفكير ${compact(u.thinkingTokens)})` : "";
    lines.push(`الاستهلاك ${model}: دخل ${compact(u.inputTokens)} · خرج ${compact(u.outputTokens)}${thinking} · كاش ${compact(u.cacheReadInputTokens)} قراءة / ${compact(u.cacheCreationInputTokens)} كتابة`);
  }
  for (const denial of message.permission_denials ?? []) lines.push(`اتمنع: ${deniedLabel(denial.tool_name, denial.tool_input ?? {})}`);
  return lines;
}

function friendlyFailure(message: SDKResultMessage): string {
  if (message.subtype === "error_max_budget_usd") return budgetMessage(env.authMode, env.runBudgetUsd);
  if (message.subtype === "error_max_turns") return "الـ Agent وصل للحد الأقصى من الخطوات قبل ما يخلّص.";
  const detail = message.subtype === "success" ? message.result : message.errors.join(" | ");
  if (looksLikeAuthProblem(detail)) return failureFor("authentication_failed", env.authMode) ?? sanitizeError(detail);
  return sanitizeError(detail || "فشل التشغيل");
}

function toResult(message: SDKResultMessage): RunnerResult {
  const costUsd = typeof message.total_cost_usd === "number" ? message.total_cost_usd : null;
  if (message.subtype === "success" && !message.is_error) {
    return { ok: true, text: message.result, costUsd };
  }
  return { ok: false, text: "", costUsd, error: friendlyFailure(message) };
}

/** Runs a job on the Claude Agent SDK: the project's real `.claude/agents/*.md` definition, with real tools. */
export const runWithSdk: Runner = async function* (job: AgentJob, signal: AbortSignal) {
  const permissions = permissionsFor(job, projectRoots());
  const controller = new AbortController();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", () => controller.abort(), { once: true });

  const options: Options = {
    cwd: env.agentRoot,
    // Dashboard-owned prompts don't want the project's CLAUDE.md (the terminal Orchestrator role) in context.
    settingSources: job.agent ? ["project"] : [],
    permissionMode: "dontAsk",
    tools: permissions.tools,
    allowedTools: permissions.allow,
    disallowedTools: permissions.deny,
    additionalDirectories: job.extraDirs,
    maxBudgetUsd: env.runBudgetUsd,
    maxTurns: permissions.maxTurns,
    model: env.model,
    // Unset = the model's default effort. Higher effort means a lot more (billed / quota-consuming) thinking.
    ...(env.effort ? { effort: env.effort } : {}),
    abortController: controller,
    persistSession: false,
    ...NO_MCP,
    env: childEnv(),
  };
  if (job.agent) options.agent = job.agent;
  else options.systemPrompt = { type: "custom", prompt: job.systemPrompt ?? "" };

  // (`as` keeps TypeScript from narrowing this to `null`: it is assigned inside the loop below.)
  let result = null as RunnerResult | null;
  // The last error code the API reported on an assistant message (auth, rate limit, billing, …). It explains a
  // failed run better than the SDK's generic result text, but is ignored when the run succeeded after a retry.
  let apiError: string | null = null;
  // A budget or turn limit has its own, more specific message than any earlier API error.
  let limitHit = false;
  try {
    for await (const message of query({ prompt: job.prompt, options })) {
      if (message.type === "assistant" && message.error) apiError = message.error;
      for (const label of stepsOf(message)) yield { type: "step", label };
      if (message.type === "result") {
        for (const label of resultDetails(message)) yield { type: "step", label };
        result = toResult(message);
        limitHit = message.subtype === "error_max_budget_usd" || message.subtype === "error_max_turns";
      }
    }
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, text: "", costUsd: null, error: "اتلغى التشغيل" };
    const raw = error instanceof Error ? error.message : String(error);
    if (/Native CLI binary|ENOENT|spawn/i.test(raw)) {
      return { ok: false, text: "", costUsd: null, error: "تعذّر تشغيل Claude Code المدمج مع الـ SDK. أعد تثبيت الحزم (npm install) وتأكد إن optional dependencies مش متخطّية." };
    }
    if (looksLikeAuthProblem(raw)) invalidateAuth();
    const known = failureFor(apiError, env.authMode) ?? (looksLikeAuthProblem(raw) ? failureFor("authentication_failed", env.authMode) : null);
    return { ok: false, text: "", costUsd: null, error: known ?? sanitizeError(error) };
  }

  if (!result?.ok && !limitHit) {
    if (apiError === "authentication_failed") invalidateAuth();
    const known = failureFor(apiError, env.authMode);
    if (known) return { ok: false, text: "", costUsd: result?.costUsd ?? null, error: known };
  }
  return result ?? { ok: false, text: "", costUsd: null, error: "انتهى التشغيل من غير نتيجة" };
};
