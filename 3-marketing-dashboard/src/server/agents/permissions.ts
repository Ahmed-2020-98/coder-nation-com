import type { AgentJob } from "./types";

/**
 * What each run may do. These are real permission rules enforced by the SDK (permissionMode "dontAsk": anything
 * not allowed below is denied), not just instructions in a prompt.
 *
 * Notes on the rule syntax (Claude Code permissions docs):
 *  - `Edit(path)` covers every file-writing tool; `Write(path)` rules are accepted but never match.
 *  - A leading `/` anchors the path at the session's working directory, i.e. the agent project root.
 *  - Reads inside the working directory need no rule, so `Read`/`Glob`/`Grep` are deliberately NOT allow-listed
 *    (a bare `Read` rule would also approve reads outside the project).
 */

export type Permissions = {
  /** Built-in tools that exist in the run at all. */
  tools: string[];
  allow: string[];
  deny: string[];
  maxTurns: number;
};

/**
 * Agents never write the user's own training and input files; the Dashboard does that itself. `mcp__*` removes every
 * MCP tool from the run: with a claude.ai login the account's connectors (Gmail, Notion, Shopify, Adobe, …) would
 * otherwise be loaded, putting thousands of tool definitions in every request (a 30x cost jump, measured) and
 * giving a marketing agent a reach it was never meant to have.
 */
const ALWAYS_DENY = ["mcp__*", "Edit(/marketing/style/**)", "Edit(/marketing/inputs/**)", "Edit(/.claude/**)", "Edit(/CLAUDE.md)"];

/**
 * `roots` = the absolute spellings of the project root (as configured and as resolved on disk, which differ on macOS:
 * /var vs /private/var). Models often write `mkdir -p /abs/path/marketing/...` instead of the relative form, and a
 * rule for only one spelling made the montage agent get refused and sometimes give up (seen in a real run).
 */
export function permissionsFor(job: Pick<AgentJob, "kind" | "agent">, roots: string[] = []): Permissions {
  switch (job.agent) {
    case "research-agent":
      return {
        tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "Edit", "Write"],
        allow: ["WebSearch", "WebFetch", "Edit(/marketing/outputs/ideas/**)"],
        deny: ALWAYS_DENY,
        maxTurns: 60,
      };
    case "script-agent":
      return {
        tools: ["Read", "Glob", "Edit", "Write"],
        allow: ["Edit(/marketing/outputs/scripts/**)"],
        deny: ALWAYS_DENY,
        maxTurns: 25,
      };
    case "montage-agent":
      return {
        tools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
        allow: [
          "Bash(ffmpeg *)",
          "Bash(ffprobe *)",
          "Bash(mkdir -p marketing/outputs/*)",
          ...[...new Set(roots)].map((root) => `Bash(mkdir -p ${root.replace(/\/+$/, "")}/marketing/outputs/*)`),
          "Edit(/marketing/outputs/montage/**)",
        ],
        deny: ALWAYS_DENY,
        maxTurns: 60,
      };
    case "posting-agent":
      return {
        // No Bash, no web: this agent cannot publish anything by construction.
        tools: ["Read", "Glob", "Edit", "Write"],
        allow: ["Edit(/marketing/outputs/posts/**)"],
        deny: ALWAYS_DENY,
        maxTurns: 25,
      };
    default:
      // Dashboard-owned prompts (shot list): read-only. The Dashboard saves the returned text itself.
      return { tools: ["Read", "Glob"], allow: [], deny: ["Edit", "Write", "Bash", ...ALWAYS_DENY], maxTurns: 12 };
  }
}
