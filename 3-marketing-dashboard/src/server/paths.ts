import "server-only";
import path from "node:path";
import { env } from "./env";

/** Throws unless `target` is `base` itself or lives inside it (blocks "../" tricks and absolute escapes). */
export function assertInside(base: string, target: string): string {
  const resolved = path.resolve(target);
  const relative = path.relative(path.resolve(base), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("المسار خارج المجلد المسموح");
  }
  return resolved;
}

/** Absolute path inside the Marketing Agent project. */
export function agentPath(...segments: string[]): string {
  return assertInside(env.agentRoot, path.resolve(env.agentRoot, ...segments));
}

/** Absolute path inside the dashboard's own data folder. */
export function dataPath(...segments: string[]): string {
  return assertInside(env.dataDir, path.resolve(env.dataDir, ...segments));
}

/** Agent-project-relative path with forward slashes (what the agents' prompts and file headers use). */
export function toAgentRelative(absolute: string): string {
  return path.relative(env.agentRoot, absolute).split(path.sep).join("/");
}

/** Resolves a path that came from the DB or the client, refusing anything outside the agent project. */
export function fromAgentRelative(relative: string): string {
  return agentPath(relative);
}

export const AGENT_DIRS = {
  inputs: "marketing/inputs",
  style: "marketing/style",
  ideas: "marketing/outputs/ideas",
  scripts: "marketing/outputs/scripts",
  montage: "marketing/outputs/montage",
  posts: "marketing/outputs/posts",
} as const;

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD in the server's local time zone (the agents' file names use local dates). */
export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
