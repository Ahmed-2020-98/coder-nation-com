import "server-only";
import { query, type AccountInfo, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { env, type AuthMode } from "../env";

/**
 * How the Agent SDK's local Claude Code process is signed in. Only the KIND of sign-in, the plan name and the
 * account email are ever read (from the SDK's own `accountInfo()`); no key and no token ever passes through here.
 */
export type AuthInfo = {
  /** "unknown" = the check itself failed or timed out; runs are still allowed and the SDK reports any real problem. */
  method: "api_key" | "subscription" | "cloud" | "none" | "unknown";
  plan?: string;
  email?: string;
  provider?: string;
};

/** Variables that identify the Claude Code session this server may have been started from. */
const PARENT_SESSION_VARS = [
  "CLAUDECODE",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_SESSION_ATTENDED",
];

/**
 * The environment handed to the SDK's Claude Code process.
 *  - Always without the parent session's identity: a Dashboard run must start as its own top-level session, even when
 *    the dev server itself was launched from inside Claude Code.
 *  - In subscription mode also without any API credentials, so a key exported in some shell can never silently turn a
 *    "free" subscription run into a billed API call.
 * Credentials meant for the child (CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_USE_BEDROCK, …) are left alone.
 */
export function childEnv(source: Record<string, string | undefined> = process.env, mode: AuthMode = env.authMode): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...source };
  for (const name of PARENT_SESSION_VARS) delete out[name];
  for (const name of Object.keys(out)) if (name.startsWith("CLAUDE_CODE_MESSAGING_")) delete out[name];
  // A claude.ai login also attaches the account's connectors (Gmail, Notion, Adobe, …). Their thousands of tool
  // definitions made one tiny shot-list run write ~190k tokens to the cache ($0.8 instead of $0.03).
  out.ENABLE_CLAUDEAI_MCP_SERVERS = "false";
  if (mode === "subscription") {
    delete out.ANTHROPIC_API_KEY;
    delete out.ANTHROPIC_AUTH_TOKEN;
  }
  return out;
}

/**
 * Agents get no MCP servers at all (none of the project's, none of the account's connectors). Together with
 * `ENABLE_CLAUDEAI_MCP_SERVERS=false` in childEnv() and the `mcp__*` deny rule, this is what brought the same job
 * from $0.77 to $0.03 in a measured A/B.
 */
export const NO_MCP = { strictMcpConfig: true, mcpServers: {} } as const;

/** Pure mapping from the SDK's account info to what the Dashboard shows. */
export function classifyAccount(info: AccountInfo | null | undefined): AuthInfo {
  if (!info) return { method: "none" };
  const provider = info.apiProvider;
  if (provider && provider !== "firstParty") return { method: "cloud", provider };
  const keySource = info.apiKeySource ?? "";
  if (keySource === "ANTHROPIC_API_KEY" || keySource === "apiKeyHelper" || keySource === "/login managed key") {
    return { method: "api_key", provider };
  }
  const oauth = Boolean(info.subscriptionType) || Boolean(info.email) || /oauth|claude\.ai/i.test(info.tokenSource ?? "");
  if (oauth) return { method: "subscription", plan: info.subscriptionType, email: info.email, provider };
  return { method: "none", provider };
}

declare global {
  var __dashboardAuth: { at: number; info: AuthInfo } | undefined;
  var __dashboardAuthPending: Promise<AuthInfo> | undefined;
}

const TTL_MS = 60_000;
const UNKNOWN_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 20_000;

/** The last result, whatever its age, or null when nothing has been checked yet. Never starts a check. */
export function knownAuth(): AuthInfo | null {
  return globalThis.__dashboardAuth?.info ?? null;
}

/** Forget the cached result (a run just failed to authenticate, or the user says they logged in). */
export function invalidateAuth(): void {
  globalThis.__dashboardAuth = undefined;
}

/**
 * Asks the SDK's local process who it is signed in as. No model call is made: the prompt stream never yields a
 * message, the process answers `accountInfo()` from its initialisation, and we close it again.
 */
async function probe(): Promise<AuthInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  timer.unref?.();
  // Holds the session open without ever sending a prompt; ends when we abort.
  async function* idle(): AsyncGenerator<SDKUserMessage, void> {
    await new Promise<void>((resolve) => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
  }
  const q = query({
    prompt: idle(),
    options: {
      cwd: env.agentRoot,
      settingSources: [],
      persistSession: false,
      permissionMode: "dontAsk",
      tools: [],
      ...NO_MCP,
      abortController: controller,
      env: childEnv(),
    },
  });
  try {
    return classifyAccount(await q.accountInfo());
  } finally {
    clearTimeout(timer);
    controller.abort();
    try {
      q.close();
    } catch {
      /* already closed */
    }
  }
}

/** Cached for a minute; concurrent callers share one check. Never throws: a failed check is "unknown". */
export async function getAuth(): Promise<AuthInfo> {
  if (env.fakeAgents) return { method: "none", provider: "simulated" };
  const cached = globalThis.__dashboardAuth;
  if (cached && Date.now() - cached.at < (cached.info.method === "unknown" ? UNKNOWN_TTL_MS : TTL_MS)) return cached.info;
  if (!globalThis.__dashboardAuthPending) {
    globalThis.__dashboardAuthPending = probe()
      .catch((): AuthInfo => ({ method: "unknown" }))
      .then((info) => {
        globalThis.__dashboardAuth = { at: Date.now(), info };
        return info;
      })
      .finally(() => {
        globalThis.__dashboardAuthPending = undefined;
      });
  }
  return globalThis.__dashboardAuthPending;
}
