import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Runner } from "@/server/agents/types";

// Modules read their configuration from process.env at import time, so they are loaded after the env is set.
let tmp: string;
let agentRoot: string;
let paths: typeof import("@/server/paths");
let comments: typeof import("@/server/files/comments");
let style: typeof import("@/server/files/style");
let db: typeof import("@/server/db");
let jobs: typeof import("@/server/jobs");

const REAL_TEMPLATE = path.resolve(import.meta.dirname, "../../2-marketing-agent/marketing/style/script-style.md");

const FALLBACK_TEMPLATE = `---
trained: false
last_updated: —
---

# أسلوبي في كتابة السكريبت

## 7. أمثلة سكريبتات ممتازة (الصقها هنا بالنص)
<!-- كل مثال -->

## 8. أمثلة مرفوضة (وليه)
<!-- مثال -->

---

## Training Log

| التاريخ | التصحيح / المثال | القاعدة المستخلصة |
|---|---|---|
`;

async function waitFor(check: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dash-test-"));
  agentRoot = path.join(tmp, "agent");
  for (const dir of ["inputs", "style", "outputs/ideas", "outputs/scripts", "outputs/montage", "outputs/posts"]) {
    fs.mkdirSync(path.join(agentRoot, "marketing", dir), { recursive: true });
  }
  const template = fs.existsSync(REAL_TEMPLATE) ? fs.readFileSync(REAL_TEMPLATE, "utf8") : FALLBACK_TEMPLATE;
  fs.writeFileSync(path.join(agentRoot, "marketing/style/script-style.md"), template);

  process.env.AGENT_ROOT = agentRoot;
  process.env.DATA_DIR = path.join(tmp, "data");
  process.env.FAKE_AGENT_RUNS = "1";
  process.env.MAX_CONCURRENT_RUNS = "5";
  vi.resetModules();
  paths = await import("@/server/paths");
  comments = await import("@/server/files/comments");
  style = await import("@/server/files/style");
  db = await import("@/server/db");
  jobs = await import("@/server/jobs");
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("path safety", () => {
  it("refuses anything outside the agent project", () => {
    expect(() => paths.agentPath("..", "secrets.txt")).toThrow();
    expect(() => paths.agentPath("marketing/../../x")).toThrow();
    expect(() => paths.assertInside(agentRoot, "/etc/passwd")).toThrow();
    expect(paths.agentPath("marketing", "style", "script-style.md").startsWith(agentRoot)).toBe(true);
  });

  it("returns agent-relative paths with forward slashes", () => {
    expect(paths.toAgentRelative(paths.agentPath("marketing", "outputs", "ideas", "a.md"))).toBe("marketing/outputs/ideas/a.md");
  });
});

describe("comments", () => {
  it("formats one comment per line and keeps the likes suffix only when there is one", () => {
    expect(comments.formatCommentLine("  كام   السعر؟ ", 42)).toBe("كام السعر؟ | 42");
    expect(comments.formatCommentLine("كام السعر؟", null)).toBe("كام السعر؟");
    expect(comments.formatCommentLine("كام السعر؟", 0)).toBe("كام السعر؟");
    expect(comments.formatCommentLine("   ", 5)).toBe("");
  });

  it("does not let a comment's own '| 5' be read as likes", () => {
    expect(comments.formatCommentLine("اختار | 5", null)).toBe("اختار / 5");
    expect(comments.formatCommentLine("a|b", 3)).toBe("a/b | 3");
  });

  it("parses likes written as 1.2K / 3,400", () => {
    expect(comments.parseLikes("1.2K")).toBe(1200);
    expect(comments.parseLikes("3,400")).toBe(3400);
    expect(comments.parseLikes("2m")).toBe(2_000_000);
    expect(comments.parseLikes("كتير")).toBeNull();
  });

  it("reads a CSV (with BOM and Arabic) and lets the user pick columns", async () => {
    const csv = "﻿الكومنت,اللايكات,المستخدم\n\"كام السعر؟\",12,a\n\"بتعملوا فلاتر؟\",,b\n,,\n";
    const table = await comments.parseTabular(Buffer.from(csv), "export.csv");
    expect(table.columns).toEqual(["الكومنت", "اللايكات", "المستخدم"]);
    expect(table.rows).toHaveLength(2);
    expect(comments.rowsToLines(table.rows, 0, 1)).toEqual(["كام السعر؟ | 12", "بتعملوا فلاتر؟"]);
    expect(comments.rowsToLines(table.rows, 0, null)).toEqual(["كام السعر؟", "بتعملوا فلاتر؟"]);
  });

  it("reads an XLSX workbook", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("c");
    sheet.addRow(["text", "likes"]);
    sheet.addRow(["كام السعر؟", 7]);
    sheet.addRow(["سؤال تاني", "1.5K"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const table = await comments.parseTabular(buffer, "x.xlsx");
    expect(comments.rowsToLines(table.rows, 0, 1)).toEqual(["كام السعر؟ | 7", "سؤال تاني | 1500"]);
  });

  it("rejects unsupported formats with a clear message", async () => {
    await expect(comments.parseTabular(Buffer.from("x"), "a.xls")).rejects.toThrow("XLS");
    await expect(comments.parseTabular(Buffer.from("x"), "a.pdf")).rejects.toThrow("TXT");
  });

  it("writes comments-YYYY-MM-DD.txt and numbers a second file of the same day", () => {
    const first = comments.writeCommentsFile(["a", "b | 3"], "2026-10-30");
    const second = comments.writeCommentsFile(["c"], "2026-10-30");
    expect(first).toMatchObject({ file: "marketing/inputs/comments-2026-10-30.txt", batch: "comments-2026-10-30", count: 2 });
    expect(second.file).toBe("marketing/inputs/comments-2026-10-30-2.txt");
    expect(fs.readFileSync(paths.agentPath(first.file), "utf8")).toBe("a\nb | 3\n");
    expect(() => comments.writeCommentsFile([], "2026-10-30")).toThrow();
  });
});

describe("style files", () => {
  const template = () => fs.readFileSync(path.join(agentRoot, "marketing/style/script-style.md"), "utf8");

  it("adds an example under section 7, before section 8, without flipping `trained`", () => {
    const out = style.appendScriptExample(template(), { title: "كام بيكلّف موقعك؟", text: "Hook\n\nالمحتوى", date: "2026-10-30" });
    const example = out.indexOf("### مثال: كام بيكلّف موقعك؟");
    expect(example).toBeGreaterThan(out.indexOf("## 7."));
    expect(example).toBeLessThan(out.indexOf("## 8."));
    expect(style.isTrained(out)).toBe(false);
    expect(out).toContain("مثال محفوظ من الـ Dashboard");
  });

  it("appends to the Training Log table and keeps earlier rows", () => {
    const once = style.appendScriptExample(template(), { title: "أ", text: "نص", date: "2026-10-30" });
    const twice = style.appendScriptExample(once, { title: "ب", text: "نص تاني", date: "2026-10-31" });
    const rows = twice.split("\n").filter((line) => line.startsWith("| 2026-"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("أ");
    expect(rows[1]).toContain("ب");
    expect(twice.indexOf("### مثال: أ")).toBeLessThan(twice.indexOf("### مثال: ب"));
  });

  it("creates the sections when the file doesn't have them", () => {
    const out = style.appendScriptExample("---\ntrained: false\n---\n# x\n", { title: "t", text: "body", date: "2026-10-30" });
    expect(out).toContain("## أمثلة سكريبتات ممتازة");
    expect(out).toContain("## Training Log");
  });

  it("escapes pipes and line breaks in log cells", () => {
    const out = style.appendTrainingLog("## Training Log\n\n| a | b | c |\n|---|---|---|\n", { date: "d", input: "x | y\nz", rule: "r" });
    expect(out).toContain("| d | x \\| y z | r |");
  });

  it("only flips `trained` when asked, and records history snapshots", () => {
    const original = template();
    const before = db.listSnapshots("script-style").length;
    style.writeStyle("script-style", style.withTrained(original, true, "2026-10-30"), "trained", "تم التدريب");
    expect(style.isTrained(style.readStyle("script-style"))).toBe(true);
    const snaps = db.listSnapshots("script-style");
    expect(snaps.length).toBe(before + 2); // baseline + this write
    expect(snaps[snaps.length - 1].source).toBe("baseline");
    expect(snaps[snaps.length - 1].content).toBe(original);
    expect(snaps[0].source).toBe("trained");
    style.writeStyle("script-style", original, "restore", "استرجاع");
    expect(style.isTrained(style.readStyle("script-style"))).toBe(false);
  });
});

describe("database", () => {
  it("creates cards with unique slugs and patches them", () => {
    const card = db.createCard({ slug: "website-cost", title: "كام السعر؟", ideaFile: "marketing/outputs/ideas/a.md", ideaNo: 1 });
    expect(card).toMatchObject({ stage: "idea", slug: "website-cost", ideaNo: 1, scriptFile: null });
    expect(() => db.createCard({ slug: "website-cost", title: "x" })).toThrow();
    const patched = db.patchCard(card.id, { stage: "script", scriptFile: "marketing/outputs/scripts/x.md" });
    expect(patched).toMatchObject({ stage: "script", scriptFile: "marketing/outputs/scripts/x.md" });
    expect(db.getCardBySlug("website-cost")?.id).toBe(card.id);
    expect(() => db.patchCard("missing", { title: "x" })).toThrow();
  });

  it("marks runs left active by a dead process as failed when it reopens", () => {
    const run = db.createRun({ cardId: null, kind: "research", label: "orphan" });
    db.updateRun(run.id, { status: "running" });
    globalThis.__dashboardDb?.close();
    globalThis.__dashboardDb = undefined; // simulate a restart: the next db() call reopens and cleans up
    const after = db.getRun(run.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toContain("توقف السيرفر");
  });
});

describe("background runs", () => {
  const writes =
    (text = "ok", cost = 0.12): Runner =>
    async function* (job) {
      yield { type: "step", label: "يشتغل" };
      if (job.expectedOutput) fs.writeFileSync(paths.agentPath(job.expectedOutput), "---\nstatus: awaiting_approval\n---\n# x\n");
      return { ok: true, text, costUsd: cost };
    };

  const job = (expectedOutput?: string) => ({ kind: "script" as const, agent: "script-agent" as const, prompt: "p", expectedOutput });

  it("records steps, cost and the output file, then calls onSuccess", async () => {
    let seen: string | null = null;
    const run = jobs.startRun({
      cardId: null,
      job: job("marketing/outputs/scripts/ok.md"),
      runner: writes(),
      onSuccess: ({ outputFile }) => void (seen = outputFile),
    });
    await waitFor(() => db.getRun(run.id)?.status === "succeeded");
    const done = db.getRun(run.id)!;
    expect(done.outputFile).toBe("marketing/outputs/scripts/ok.md");
    expect(done.costUsd).toBe(0.12);
    expect(done.steps.map((s) => s.label)).toEqual(expect.arrayContaining(["بدء التشغيل", "يشتغل", "حفظ النتيجة"]));
    expect(seen).toBe("marketing/outputs/scripts/ok.md");
  });

  it("fails the run when the agent finished but wrote nothing", async () => {
    const run = jobs.startRun({ cardId: null, job: job("marketing/outputs/scripts/never.md"), runner: async function* () { return { ok: true, text: "", costUsd: 0 }; } });
    await waitFor(() => db.getRun(run.id)?.status === "failed");
    expect(db.getRun(run.id)?.error).toContain("لم ينتج ملف");
  });

  it("falls back to the newest file in the output folder when the agent chose another name", async () => {
    const other: Runner = async function* () {
      fs.writeFileSync(paths.agentPath("marketing/outputs/scripts/other-name.md"), "# x");
      return { ok: true, text: "", costUsd: 0 };
    };
    const run = jobs.startRun({ cardId: null, job: job("marketing/outputs/scripts/expected-name.md"), runner: other });
    await waitFor(() => db.getRun(run.id)?.status === "succeeded");
    expect(db.getRun(run.id)?.outputFile).toBe("marketing/outputs/scripts/other-name.md");
  });

  it("turns a runner failure or an onSuccess exception into a failed run with the message", async () => {
    const bad = jobs.startRun({ cardId: null, job: job(), runner: async function* () { return { ok: false, text: "", costUsd: 0.5, error: "الميزانية خلصت" }; } });
    await waitFor(() => db.getRun(bad.id)?.status === "failed");
    expect(db.getRun(bad.id)).toMatchObject({ error: "الميزانية خلصت", costUsd: 0.5 });

    const throwing = jobs.startRun({ cardId: null, job: job(), runner: writes(), onSuccess: () => { throw new Error("تعذّر قراءة الملف sk-ant-abc123secret"); } });
    await waitFor(() => db.getRun(throwing.id)?.status === "failed");
    const error = db.getRun(throwing.id)!.error!;
    expect(error).toContain("تعذّر قراءة الملف");
    expect(error).not.toContain("sk-ant-abc123secret"); // keys never reach the DB or the UI
  });

  it("allows one active run per card and can cancel it", async () => {
    const card = db.createCard({ slug: "busy-card", title: "busy" });
    const hang: Runner = async function* (_job, signal) {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
      return { ok: false, text: "", costUsd: null, error: "اتلغى التشغيل" };
    };
    const first = jobs.startRun({ cardId: card.id, job: job(), runner: hang });
    await waitFor(() => db.getRun(first.id)?.status === "running");
    expect(() => jobs.startRun({ cardId: card.id, job: job(), runner: hang })).toThrow(/شغّال/);
    expect(jobs.cancelRun(first.id)).toBe(true);
    await waitFor(() => db.getRun(first.id)?.status === "cancelled");
    expect(jobs.cancelRun(first.id)).toBe(false);
  });
});
