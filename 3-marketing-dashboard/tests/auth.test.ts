import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AccountInfo } from "@anthropic-ai/claude-agent-sdk";

// How the agents sign in (API key vs the claude.ai subscription login). Everything here is deterministic: nothing
// spawns Claude Code or touches the network. The real sign-in is checked by `npm run smoke:agents -- --wiring`.

const SAVED = { ...process.env };
let tmp: string;

function resetEnv(extra: Record<string, string> = {}) {
  for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_AUTH", "FAKE_AGENT_RUNS", "MAX_CONCURRENT_RUNS"]) delete process.env[name];
  Object.assign(process.env, { AGENT_ROOT: path.join(tmp, "agent"), DATA_DIR: path.join(tmp, "data") }, extra);
  delete (globalThis as { __dashboardAuth?: unknown }).__dashboardAuth;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash-auth-"));
});
afterEach(() => vi.resetModules());
afterAll(() => {
  process.env = SAVED;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("env.authMode", () => {
  const load = async () => (await import("@/server/env")).env;

  it("uses the subscription login when there is no key, with one run at a time", async () => {
    resetEnv();
    const env = await load();
    expect(env.authMode).toBe("subscription");
    expect(env.maxConcurrentRuns).toBe(1);
  });

  it("uses the key when one is present", async () => {
    resetEnv({ ANTHROPIC_API_KEY: "sk-ant-test" });
    const env = await load();
    expect(env.authMode).toBe("api_key");
    expect(env.maxConcurrentRuns).toBe(2);
  });

  it("CLAUDE_AUTH overrides what is detected, and MAX_CONCURRENT_RUNS overrides the default", async () => {
    resetEnv({ ANTHROPIC_API_KEY: "sk-ant-test", CLAUDE_AUTH: "subscription", MAX_CONCURRENT_RUNS: "3" });
    const a = await load();
    expect(a.authMode).toBe("subscription");
    expect(a.maxConcurrentRuns).toBe(3);
    vi.resetModules();
    resetEnv({ CLAUDE_AUTH: "api_key" });
    expect((await load()).authMode).toBe("api_key");
    vi.resetModules();
    resetEnv({ CLAUDE_AUTH: "nonsense" });
    expect((await load()).authMode).toBe("subscription"); // an unknown value is ignored, never trusted
  });

  it("never copies the key into the config object", async () => {
    resetEnv({ ANTHROPIC_API_KEY: "sk-ant-canary-123" });
    expect(JSON.stringify(await load())).not.toContain("canary");
  });
});

describe("childEnv", () => {
  const source = {
    PATH: "/usr/bin",
    HOME: "/home/x",
    ANTHROPIC_API_KEY: "sk-ant-canary",
    ANTHROPIC_AUTH_TOKEN: "tok",
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: "abc",
    CLAUDE_CODE_ENTRYPOINT: "cli",
    CLAUDE_CODE_CHILD_SESSION: "1",
    CLAUDE_CODE_EXECPATH: "/x/claude",
    CLAUDE_CODE_SESSION_ATTENDED: "1",
    CLAUDE_CODE_MESSAGING_SOCKET: "/tmp/s",
    CLAUDE_CODE_MESSAGING_TOKEN: "secret",
    CLAUDE_CODE_OAUTH_TOKEN: "oauth",
    CLAUDE_CODE_USE_BEDROCK: "1",
  };

  it("subscription mode hides every API credential and the parent session, and keeps the rest", async () => {
    resetEnv();
    const { childEnv } = await import("@/server/agents/auth");
    const out = childEnv(source, "subscription");
    expect(out.ANTHROPIC_API_KEY).toBeUndefined();
    expect(out.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_SESSION_ATTENDED", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN"]) {
      expect(out, name).not.toHaveProperty(name);
    }
    expect(out).toMatchObject({ PATH: "/usr/bin", HOME: "/home/x", CLAUDE_CODE_OAUTH_TOKEN: "oauth", CLAUDE_CODE_USE_BEDROCK: "1" });
  });

  it("always switches the account's claude.ai connectors off (measured: ~190k tokens of tool definitions per run)", async () => {
    resetEnv();
    const { childEnv, NO_MCP } = await import("@/server/agents/auth");
    expect(childEnv(source, "subscription").ENABLE_CLAUDEAI_MCP_SERVERS).toBe("false");
    expect(childEnv(source, "api_key").ENABLE_CLAUDEAI_MCP_SERVERS).toBe("false");
    expect(NO_MCP).toEqual({ strictMcpConfig: true, mcpServers: {} });
  });

  it("api_key mode keeps the key but still starts a fresh session", async () => {
    resetEnv();
    const { childEnv } = await import("@/server/agents/auth");
    const out = childEnv(source, "api_key");
    expect(out.ANTHROPIC_API_KEY).toBe("sk-ant-canary");
    expect(out).not.toHaveProperty("CLAUDECODE");
    expect(out).not.toHaveProperty("CLAUDE_CODE_MESSAGING_TOKEN");
  });

  it("does not touch the environment it was given", async () => {
    resetEnv();
    const { childEnv } = await import("@/server/agents/auth");
    const copy = { ...source };
    childEnv(copy, "subscription");
    expect(copy).toEqual(source);
  });
});

describe("classifyAccount", () => {
  const info = (over: Partial<AccountInfo>): AccountInfo => over;
  it("tells the sign-in kinds apart without ever needing a secret", async () => {
    resetEnv();
    const { classifyAccount } = await import("@/server/agents/auth");
    expect(classifyAccount(null)).toEqual({ method: "none" });
    expect(classifyAccount(info({}))).toMatchObject({ method: "none" });
    expect(classifyAccount(info({ apiProvider: "firstParty", subscriptionType: "pro", email: "me@x.io", apiKeySource: "none" }))).toEqual({
      method: "subscription",
      plan: "pro",
      email: "me@x.io",
      provider: "firstParty",
    });
    expect(classifyAccount(info({ apiProvider: "firstParty", apiKeySource: "ANTHROPIC_API_KEY" }))).toMatchObject({ method: "api_key" });
    expect(classifyAccount(info({ apiKeySource: "apiKeyHelper" }))).toMatchObject({ method: "api_key" });
    expect(classifyAccount(info({ apiProvider: "bedrock" }))).toEqual({ method: "cloud", provider: "bedrock" });
    expect(classifyAccount(info({ tokenSource: "CLAUDE_CODE_OAUTH_TOKEN" }))).toMatchObject({ method: "subscription" });
  });
});

describe("failure wording", () => {
  it("explains each failure for the way the user signs in", async () => {
    const { failureFor, NOT_LOGGED_IN } = await import("@/server/agents/failures");
    const codes = ["authentication_failed", "rate_limit", "oauth_org_not_allowed", "account_on_hold", "verification_required", "billing_error", "overloaded", "model_not_found"];
    for (const code of codes) {
      for (const mode of ["subscription", "api_key"] as const) {
        const message = failureFor(code, mode);
        expect(message, `${code}/${mode}`).toBeTruthy();
        expect(message).not.toMatch(/sk-ant/);
      }
    }
    expect(failureFor("authentication_failed", "subscription")).toContain("/login");
    expect(failureFor("authentication_failed", "subscription")).not.toContain("ANTHROPIC_API_KEY");
    expect(failureFor("authentication_failed", "api_key")).toContain("ANTHROPIC_API_KEY");
    expect(failureFor("rate_limit", "subscription")).toContain("اشتراك");
    expect(failureFor("something_new", "subscription")).toBeNull();
    expect(failureFor(null, "api_key")).toBeNull();
    expect(NOT_LOGGED_IN).toContain("/login");
    expect(NOT_LOGGED_IN).toContain("ANTHROPIC_API_KEY");
  });

  it("recognises authentication problems in free text, and budget wording matches the mode", async () => {
    const { looksLikeAuthProblem, budgetMessage } = await import("@/server/agents/failures");
    expect(looksLikeAuthProblem("Invalid API key · Please run /login")).toBe(true);
    expect(looksLikeAuthProblem("401 Unauthorized")).toBe(true);
    expect(looksLikeAuthProblem("ffmpeg exited with code 1")).toBe(false);
    expect(budgetMessage("subscription", 2)).toContain("تقديري");
    expect(budgetMessage("api_key", 2)).toContain("الميزانية");
  });
});

describe("run gate and health", () => {
  const stubRunner = async function* () {
    return { ok: true, text: "ok", costUsd: 0 };
  };
  const job = { kind: "research" as const, agent: "research-agent" as const, prompt: "x" };

  async function finished(db: typeof import("@/server/db"), id: string) {
    for (let i = 0; i < 200; i++) {
      const run = db.getRun(id)!;
      if (run.status === "succeeded" || run.status === "failed") return run;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("run did not finish");
  }

  it("refuses to start only when the sign-in is KNOWN to be missing", async () => {
    resetEnv();
    const jobs = await import("@/server/jobs");
    const types = await import("@/server/agents/types");
    const db = await import("@/server/db");
    const auth = globalThis as { __dashboardAuth?: { at: number; info: { method: string } } };

    auth.__dashboardAuth = { at: Date.now(), info: { method: "none" } };
    try {
      jobs.startRun({ cardId: null, job, runner: stubRunner });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(types.RunStartError);
      expect((error as InstanceType<typeof types.RunStartError>).code).toBe("not_logged_in");
    }

    // never checked yet: let it through, the SDK reports any real problem itself
    delete auth.__dashboardAuth;
    expect((await finished(db, jobs.startRun({ cardId: null, job, runner: stubRunner }).id)).status).toBe("succeeded");

    // checked and signed in
    auth.__dashboardAuth = { at: Date.now(), info: { method: "subscription" } };
    expect((await finished(db, jobs.startRun({ cardId: null, job, runner: stubRunner }).id)).status).toBe("succeeded");
  });

  it("the simulator never needs a sign-in", async () => {
    resetEnv({ FAKE_AGENT_RUNS: "1" });
    const jobs = await import("@/server/jobs");
    const db = await import("@/server/db");
    (globalThis as { __dashboardAuth?: unknown }).__dashboardAuth = { at: Date.now(), info: { method: "none" } };
    expect((await finished(db, jobs.startRun({ cardId: null, job, runner: stubRunner }).id)).status).toBe("succeeded");
  });

  it("health reports how the agents sign in and nothing secret", async () => {
    resetEnv({ ANTHROPIC_API_KEY: "sk-ant-canary-xyz", CLAUDE_AUTH: "subscription" });
    (globalThis as { __dashboardAuth?: unknown }).__dashboardAuth = { at: Date.now(), info: { method: "subscription", plan: "pro", email: "me@x.io" } };
    const { getHealth } = await import("@/server/services/health");
    const health = await getHealth();
    expect(health.auth).toEqual({ method: "subscription", plan: "pro", email: "me@x.io", mode: "subscription" });
    expect(JSON.stringify(health)).not.toMatch(/sk-ant|canary/);
    expect(health).not.toHaveProperty("apiKey");
  });
});
