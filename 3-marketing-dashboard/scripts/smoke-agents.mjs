// Checks the REAL agents, on a throw-away copy of ../2-marketing-agent (your real outputs are never touched).
//
//   npm run smoke:agents -- --wiring   free, no model call: the Agent SDK loads the project, lists the 4 agents and
//                                      reports HOW it is signed in (API key / claude.ai subscription / cloud; no secrets).
//   npm run smoke:agents               real end-to-end run of all four agents on 12 synthetic comments.
//                                      Needs a sign-in: either ANTHROPIC_API_KEY (environment or .env.local; billed per
//                                      token) or the claude.ai login that `claude` already has (counts against your plan's
//                                      usage limits; five runs, one of them reading video frames). Each run is capped by
//                                      RUN_BUDGET_USD (default 2).
//
// Exit code 0 = everything passed.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, process.env.AGENT_SOURCE ?? "../2-marketing-agent");
const EXPECTED = ["research-agent", "script-agent", "montage-agent", "posting-agent"];
const wiringOnly = process.argv.includes("--wiring");

/** Minimal .env.local reader so the key never has to be exported in the shell. Values are never printed. */
function loadEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value && !(match[1] in process.env)) process.env[match[1]] = value;
  }
}

if (!fs.existsSync(path.join(source, ".claude", "agents"))) {
  console.error(`Agent project not found at ${source} (set AGENT_SOURCE=<path to 2-marketing-agent>).`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-agents-"));
const agentRoot = path.join(tmp, "agent");
fs.cpSync(source, agentRoot, { recursive: true, filter: (file) => !file.includes(`${path.sep}node_modules`) });
const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });

/** The environment for the SDK's process: no parent Claude Code session, and no API key when we want the login. */
function sdkEnv() {
  const out = { ...process.env };
  for (const name of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_SESSION_ATTENDED"]) delete out[name];
  for (const name of Object.keys(out)) if (name.startsWith("CLAUDE_CODE_MESSAGING_")) delete out[name];
  if (process.env.CLAUDE_AUTH === "subscription") {
    delete out.ANTHROPIC_API_KEY;
    delete out.ANTHROPIC_AUTH_TOKEN;
  }
  return out;
}

/** Same classification as src/server/agents/auth.ts (classifyAccount), kept tiny here because this is plain JS. */
function describeAccount(info) {
  if (info.apiProvider && info.apiProvider !== "firstParty") return { usable: true, text: `cloud provider (${info.apiProvider})` };
  if (["ANTHROPIC_API_KEY", "apiKeyHelper", "/login managed key"].includes(info.apiKeySource ?? "")) return { usable: true, text: "API key (billed per token)" };
  if (info.subscriptionType || info.email || /oauth|claude\.ai/i.test(info.tokenSource ?? "")) {
    return { usable: true, text: `claude.ai subscription login${info.subscriptionType ? ` (${info.subscriptionType})` : ""}: uses your plan's usage limits` };
  }
  return { usable: false, text: "NOT signed in" };
}

async function wiring() {
  // initializationResult()/accountInfo()/supportedAgents() are answered by the local Claude Code process before any
  // model call. The prompt stream below never yields, so nothing is ever sent to the model: no key, no usage.
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const controller = new AbortController();
  async function* idle() {
    await new Promise((resolve) => controller.signal.addEventListener("abort", resolve, { once: true }));
  }
  const q = query({
    prompt: idle(),
    options: { cwd: agentRoot, settingSources: ["project"], permissionMode: "dontAsk", persistSession: false, abortController: controller, env: sdkEnv() },
  });
  try {
    const [agentList, account] = await Promise.all([q.supportedAgents(), q.accountInfo()]);
    const agents = agentList.map((a) => a.name);
    const missing = EXPECTED.filter((name) => !agents.includes(name));
    for (const name of EXPECTED) console.log(`${agents.includes(name) ? "✓" : "✗"} ${name}`);
    const who = describeAccount(account);
    console.log(`${who.usable ? "✓" : "✗"} sign-in: ${who.text}`);
    signedIn = who.usable;
    if (missing.length) {
      console.error(`\nMissing agents: ${missing.join(", ")}. Loaded: ${agents.join(", ") || "(none)"}`);
      return false;
    }
    console.log("\nAll 4 agents load from the project's .claude/agents/ through the Agent SDK.");
    return true;
  } finally {
    controller.abort();
    try {
      q.close();
    } catch {
      /* already closed */
    }
  }
}

let ok = false;
let signedIn = false;
try {
  loadEnvLocal();
  ok = await wiring();
  if (ok && !wiringOnly) {
    if (!signedIn) {
      console.error("\nNot signed in: run `claude` and /login, or set ANTHROPIC_API_KEY (environment or .env.local). Use --wiring for the free check.");
      ok = false;
    } else {
      console.log("\nReal run starting. It uses the sign-in shown above (API key = money, subscription = your plan's usage limits). Temp project: " + agentRoot + "\n");
      const result = spawnSync(path.join(root, "node_modules", ".bin", "vitest"), ["run", "--config", "vitest.smoke.config.mts", "--reporter=verbose"], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, AGENT_ROOT: agentRoot, DATA_DIR: path.join(tmp, "data"), FAKE_AGENT_RUNS: "", MAX_CONCURRENT_RUNS: "1", NODE_ENV: "test" },
      });
      ok = result.status === 0;
    }
  }
} catch (error) {
  console.error("\nSmoke check crashed:", error instanceof Error ? error.message : error);
  ok = false;
} finally {
  // A real run keeps its throw-away project (pass or fail): the files in it are the thing you have to read, since the
  // test only proves the templates and totals, not the quality. The wiring check has nothing worth keeping.
  if (wiringOnly) cleanup();
  else console.log(`\nThe throw-away project (everything the agents wrote) is kept at: ${agentRoot}\nDelete it when you're done: rm -rf "${tmp}"`);
}
process.exit(ok ? 0 : 1);
