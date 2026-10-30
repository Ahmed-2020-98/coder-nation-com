import fs from "node:fs";
import path from "node:path";
import { env, type AuthMode } from "../env";
import { getAuth, type AuthInfo } from "../agents/auth";
import { agentPath } from "../paths";
import { isTrained, readStyle } from "../files/style";
import { toolAvailable } from "../files/video";

export type Health = {
  /** How the agents sign in. Only the kind, plan name and account email: no key and no token is ever in here. */
  auth: AuthInfo & { mode: AuthMode };
  simulated: boolean;
  ffmpeg: boolean;
  ffprobe: boolean;
  agentRoot: { exists: boolean; path: string };
  agents: string[];
  expectedAgents: string[];
  orchestratorFile: boolean;
  styles: { scriptTrained: boolean; montageTrained: boolean };
  model: string;
  budgetUsd: number;
};

const EXPECTED = ["research-agent", "script-agent", "montage-agent", "posting-agent"];

declare global {
  var __dashboardTools: { at: number; ffmpeg: boolean; ffprobe: boolean } | undefined;
}

async function tools(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  const cached = globalThis.__dashboardTools;
  if (cached && Date.now() - cached.at < 60_000) return { ffmpeg: cached.ffmpeg, ffprobe: cached.ffprobe };
  const [ffmpeg, ffprobe] = await Promise.all([toolAvailable("ffmpeg"), toolAvailable("ffprobe")]);
  globalThis.__dashboardTools = { at: Date.now(), ffmpeg, ffprobe };
  return { ffmpeg, ffprobe };
}

/** The sign-in check spawns a local process, so a page never waits on it for more than a few seconds. */
async function authForHealth(): Promise<AuthInfo> {
  const timeout = new Promise<AuthInfo>((resolve) => setTimeout(() => resolve({ method: "unknown" }), 3_000).unref?.());
  return Promise.race([getAuth(), timeout]);
}

export async function getHealth(): Promise<Health> {
  const root = env.agentRoot;
  const exists = fs.existsSync(root);
  const agentsDir = exists ? path.join(root, ".claude", "agents") : "";
  const agents = exists && fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")) : [];
  const [{ ffmpeg, ffprobe }, auth] = await Promise.all([tools(), authForHealth()]);
  const safeRead = (name: "script-style" | "montage-style") => (exists ? isTrained(readStyle(name)) : false);
  return {
    auth: { ...auth, mode: env.authMode },
    simulated: env.fakeAgents,
    ffmpeg,
    ffprobe,
    // The absolute path is only useful on this machine; it is not a secret and the dashboard is local-only.
    agentRoot: { exists, path: exists ? agentPath(".") : root },
    agents,
    expectedAgents: EXPECTED,
    orchestratorFile: exists && fs.existsSync(path.join(root, "CLAUDE.md")),
    styles: { scriptTrained: safeRead("script-style"), montageTrained: safeRead("montage-style") },
    model: env.model,
    budgetUsd: env.runBudgetUsd,
  };
}
