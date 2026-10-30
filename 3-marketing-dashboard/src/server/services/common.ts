import fs from "node:fs";
import { AGENT_DIRS, agentPath, assertInside } from "../paths";
import { atomicWrite, setFrontmatter } from "../files/markdown";
import { getCard, type Card } from "../db";
import type { Stage } from "@/lib/stages";

/** An expected, user-facing failure (bad input, wrong stage, missing file). `message` is shown as-is. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Machine-readable reason the UI can act on (e.g. "needs_force" = ask the user to confirm and retry). */
    public code?: string,
  ) {
    super(message);
  }
}

export function requireCard(id: string): Card {
  const card = getCard(id);
  if (!card) throw new ServiceError(404, "الكارت غير موجود");
  return card;
}

export function requireStage(card: Card, allowed: Stage[], message: string): void {
  if (!allowed.includes(card.stage)) throw new ServiceError(409, message);
}

type OutputDir = "ideas" | "scripts" | "montage" | "posts" | "inputs";

/** Resolves an agent-relative path and refuses anything outside the expected folder (DB values and clients are untrusted). */
export function outputPath(relative: string, dir: OutputDir): string {
  return assertInside(agentPath(AGENT_DIRS[dir]), agentPath(relative));
}

export function readOutput(relative: string, dir: OutputDir): string {
  const file = outputPath(relative, dir);
  if (!fs.existsSync(file)) throw new ServiceError(404, "الملف غير موجود");
  return fs.readFileSync(file, "utf8");
}

export function writeOutput(relative: string, dir: OutputDir, content: string): void {
  atomicWrite(outputPath(relative, dir), content);
}

/** Updates keys in the file's frontmatter (status, selected_idea, slug...) and leaves the body untouched. */
export function updateOutputHeader(relative: string, dir: OutputDir, updates: Record<string, string>): void {
  writeOutput(relative, dir, setFrontmatter(readOutput(relative, dir), updates));
}

export function outputExists(relative: string | null, dir: OutputDir): boolean {
  if (!relative) return false;
  try {
    return fs.existsSync(outputPath(relative, dir));
  } catch {
    return false;
  }
}
