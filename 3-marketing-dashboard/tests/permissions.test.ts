import { describe, expect, it } from "vitest";
import { permissionsFor } from "@/server/agents/permissions";
import type { AgentName } from "@/server/agents/types";

// What each agent is allowed to do is enforced by the SDK (not by the prompt), so the rules deserve their own tests.

const AGENTS: AgentName[] = ["research-agent", "script-agent", "montage-agent", "posting-agent"];
const job = (agent: AgentName | null) => ({ kind: "research" as const, agent });

describe("permissionsFor", () => {
  it("no run, agent or shot list, may use any MCP tool (account connectors are never reachable)", () => {
    for (const agent of [...AGENTS, null]) expect(permissionsFor(job(agent)).deny, String(agent)).toContain("mcp__*");
  });

  it("no run may write the user's training and input files, the agent definitions or CLAUDE.md", () => {
    for (const agent of [...AGENTS, null]) {
      const { deny } = permissionsFor(job(agent));
      for (const rule of ["Edit(/marketing/style/**)", "Edit(/marketing/inputs/**)", "Edit(/.claude/**)", "Edit(/CLAUDE.md)"]) expect(deny, `${agent} ${rule}`).toContain(rule);
    }
  });

  it("each agent can write only its own output folder", () => {
    const edits = (agent: AgentName) => permissionsFor(job(agent)).allow.filter((rule) => rule.startsWith("Edit("));
    expect(edits("research-agent")).toEqual(["Edit(/marketing/outputs/ideas/**)"]);
    expect(edits("script-agent")).toEqual(["Edit(/marketing/outputs/scripts/**)"]);
    expect(edits("montage-agent")).toEqual(["Edit(/marketing/outputs/montage/**)"]);
    expect(edits("posting-agent")).toEqual(["Edit(/marketing/outputs/posts/**)"]);
  });

  it("only the montage agent has a shell, and only for ffmpeg/ffprobe/mkdir; posting has neither shell nor web", () => {
    for (const agent of AGENTS) {
      const p = permissionsFor(job(agent));
      expect(p.tools.includes("Bash"), `${agent} Bash`).toBe(agent === "montage-agent");
    }
    const montage = permissionsFor(job("montage-agent")).allow.filter((rule) => rule.startsWith("Bash("));
    expect(montage.every((rule) => /^Bash\((ffmpeg|ffprobe|mkdir -p) /.test(rule))).toBe(true);
    const posting = permissionsFor(job("posting-agent"));
    expect(posting.tools).not.toContain("WebSearch");
    expect(posting.tools).not.toContain("WebFetch");
  });

  it("the montage agent may mkdir under the project root spelled absolutely, in every spelling it can resolve to", () => {
    const rules = permissionsFor(job("montage-agent"), ["/var/x/agent", "/private/var/x/agent/", "/var/x/agent"]).allow;
    expect(rules).toContain("Bash(mkdir -p marketing/outputs/*)");
    expect(rules).toContain("Bash(mkdir -p /var/x/agent/marketing/outputs/*)");
    expect(rules).toContain("Bash(mkdir -p /private/var/x/agent/marketing/outputs/*)"); // trailing slash trimmed
    expect(rules.filter((r) => r === "Bash(mkdir -p /var/x/agent/marketing/outputs/*)")).toHaveLength(1); // no duplicates
    // other agents never get shell rules from the roots
    expect(permissionsFor(job("script-agent"), ["/var/x/agent"]).allow.some((r) => r.startsWith("Bash"))).toBe(false);
  });

  it("the shot-list job (no agent) is read-only", () => {
    const p = permissionsFor(job(null));
    expect(p.tools).toEqual(["Read", "Glob"]);
    expect(p.allow).toEqual([]);
    expect(p.deny).toEqual(expect.arrayContaining(["Edit", "Write", "Bash"]));
  });
});
