// Runs the dashboard against an ISOLATED copy of the Marketing Agent project with the agents SIMULATED:
//   npm run demo            -> prepares data/demo (once) and starts the dev server on http://127.0.0.1:3010
//   npm run demo -- --reset -> throws the demo data away first
//
// Nothing here calls the Claude API or touches ../2-marketing-agent. The simulator writes files in the same
// templates the real agents are told to write, so every screen can be explored for free. It proves nothing
// about how well the real agents cluster, write or plan: that needs a real sign-in (see README).

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, process.env.AGENT_SOURCE ?? "../2-marketing-agent");
const demo = path.join(root, "data", "demo");
const agentRoot = path.join(demo, "agent-root");

if (process.argv.includes("--reset")) fs.rmSync(demo, { recursive: true, force: true });

if (!fs.existsSync(agentRoot)) {
  if (!fs.existsSync(source)) {
    console.error(`Agent project not found at ${source}. Set AGENT_SOURCE=<path to 2-marketing-agent>.`);
    process.exit(1);
  }
  fs.mkdirSync(demo, { recursive: true });
  fs.cpSync(source, agentRoot, { recursive: true, filter: (file) => !file.includes(`${path.sep}node_modules`) });
  console.log(`Demo agent project created at ${path.relative(root, agentRoot)}`);
}

const child = spawn("npx", ["next", "dev", "-p", "3010", "-H", "127.0.0.1"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, AGENT_ROOT: agentRoot, DATA_DIR: demo, FAKE_AGENT_RUNS: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
