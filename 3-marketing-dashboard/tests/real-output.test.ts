import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIdeas } from "@/server/parse/ideas";

// Fixtures in tests/fixtures/real-*.md are files research-agent ACTUALLY wrote in a real run (3 synthetic comments,
// 2026-10-29, through the Dashboard with the claude.ai login). The other fixtures are my reading of the template;
// these pin the parsers to what the real agent produces, including the quirks the template didn't predict.

const real = fs.readFileSync(path.join(import.meta.dirname, "fixtures/real-ideas-3-comments.md"), "utf8");

describe("research-agent's real output", () => {
  const parsed = parseIdeas(real);

  it("reads the header and the batch summary, and the agent's own sum check holds", () => {
    expect(parsed.header).toMatchObject({ stage: "research", status: "awaiting_approval", batch: "comments-2026-10-29" });
    expect(String(parsed.header.pre_training)).toBe("true");
    expect(parsed.summary).toMatchObject({ total: 3, classified: 3, unrelated: 0 });
    expect(parsed.sumCheck).toEqual({ ok: true, clusterSum: 3, total: 3 });
    expect(parsed.warnings).toEqual([]);
  });

  it("finds both ideas (the agent honestly wrote 2, not 5) with counts, percentages and likes", () => {
    expect(parsed.ideas).toHaveLength(2);
    expect(parsed.ideas[0]).toMatchObject({ no: 1, title: "كام سعر عمل موقع إلكتروني لشركتك؟", count: 2, percent: 66.7, likes: 16, hookIsDraft: true });
    expect(parsed.ideas[1]).toMatchObject({ no: 2, count: 1, percent: 33.3, likes: 7, hookIsDraft: true });
  });

  it("takes the FIRST quoted comment as the representative question when the agent lists several", () => {
    // the line is: "كام سعر عمل موقع إلكتروني؟" (C001) — و"بكام تصميم موقع لشركة؟" (C002)
    expect(parsed.ideas[0].question).toBe("كام سعر عمل موقع إلكتروني؟");
    expect(parsed.ideas[0].questionRef).toBe("C001");
    expect(parsed.ideas[1].question).toBe("بتعملوا تطبيقات موبايل؟");
    expect(parsed.ideas[1].questionRef).toBe("C003");
  });

  it("reads the cluster table (including the empty K00 row) and the comment mapping", () => {
    expect(parsed.clusters.map((c) => [c.id, c.count])).toEqual([
      ["K01", 2],
      ["K02", 1],
      ["K00", 0],
    ]);
    expect(parsed.mappingCount).toBe(3);
    expect(parsed.mapping.map((m) => [m.id, m.cluster, m.likes])).toEqual([
      ["C001", "K01", 12],
      ["C002", "K01", 4],
      ["C003", "K02", 7],
    ]);
  });

  it("keeps hooks free of the draft marker and of quotes", () => {
    expect(parsed.ideas[0].hook).toBe("بتسأل كام سعر عمل موقع لشركتك؟ تعال نفهم السعر بيتحدد على إيه.");
  });
});

describe("research-agent's real output for 12 comments (totals row, tied runners-up, K09 as the unrelated bucket)", () => {
  const parsed = parseIdeas(fs.readFileSync(path.join(import.meta.dirname, "fixtures/real-ideas-12-comments.md"), "utf8"));

  it("does not count the closing 'المجموع' row as a cluster, so the sum check passes (it failed on this exact file)", () => {
    expect(parsed.clusters.map((c) => c.id)).toEqual(["K01", "K02", "K03", "K04", "K05", "K06", "K07", "K08", "K09"]);
    expect(parsed.clusters.reduce((sum, c) => sum + c.count, 0)).toBe(12);
    expect(parsed.sumCheck).toEqual({ ok: true, clusterSum: 12, total: 12 });
    expect(parsed.summary).toMatchObject({ total: 12, classified: 11, unrelated: 1 });
    expect(parsed.warnings).toEqual([]);
  });

  it("reads the 5 numbered ideas and ignores the un-numbered runners-up block without a false warning", () => {
    expect(parsed.ideas.map((i) => i.no)).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.ideas[0]).toMatchObject({ count: 3, percent: 25, likes: 67, question: "كام سعر عمل موقع إلكتروني؟", questionRef: "C001" });
  });

  it("takes the first comment of a comma-separated list as the question", () => {
    expect(parsed.ideas[1]).toMatchObject({ question: "بتعملوا تطبيقات موبايل؟", questionRef: "C004", count: 2, percent: 16.7, likes: 30 });
  });

  it("maps all 12 comments, with the unrelated one in K09", () => {
    expect(parsed.mappingCount).toBe(12);
    expect(parsed.mapping.find((m) => m.id === "C010")).toMatchObject({ cluster: "K09", likes: 30 });
    expect(parsed.mapping.reduce((sum, m) => sum + (m.likes ?? 0), 0)).toBe(182);
  });
});

describe("the real script, shot list, montage plan and post from one end-to-end run", () => {
  const read = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");

  it("script: the agent's '— N كلمات' notes are not part of what is spoken, so they don't reach the editor or the duration", async () => {
    const { parseScript, describeDuration, serializeScript } = await import("@/server/parse/script");
    const parsed = parseScript(read("real-script.md"));
    expect(parsed.parts.hook).toBe("كثيرون سألوا: كم يكلف عمل موقع إلكتروني؟");
    expect(parsed.parts.cta).toBe("اكتب لنا في التعليقات ما الذي تريد بناءه، وتابعنا للمزيد.");
    expect(parsed.parts.body.startsWith("[يحدده صاحب المشروع")).toBe(true);
    expect(parsed.parts.missing).toContain("السعر");
    expect(parsed.header).toMatchObject({ stage: "script", slug: "smoke-test-idea" });
    const info = describeDuration(parsed.parts, null);
    expect(info.hookWords).toBe(7); // "كثيرون سألوا: كم يكلف عمل موقع إلكتروني؟" (the agent's own note said 7 too)
    expect(info.rateIsAssumed).toBe(true);
    // saving without edits must not put the note back, nor lose the sections the dashboard doesn't edit
    const saved = serializeScript(read("real-script.md"), parsed.parts, info);
    expect(saved).not.toMatch(/\d+ كلمات/);
    expect(saved).toContain("## معلومات ناقصة");
    expect(parseScript(saved).parts).toEqual(parsed.parts);
  });

  it("montage: reads the 3-row timeline with exact seconds and keeps the agent's gaps list", async () => {
    const { parseMontage } = await import("@/server/parse/montage");
    const parsed = parseMontage(read("real-montage.md"));
    expect(parsed.timeline.map((r) => [r.start, r.end])).toEqual([[0, 3], [3, 9], [9, 12]]);
    expect(parsed.timeline[0].text).toContain("كثيرون سألوا");
    expect(parsed.warnings).toEqual([]);
  });

  it("post: caption, no keyword tags, five suggested tags, and a timing note that admits it is a guess", async () => {
    const { parsePost } = await import("@/server/parse/post");
    const parsed = parsePost(read("real-post.md"));
    expect(parsed.parts.caption.startsWith("كثيرون سألوا")).toBe(true);
    expect(parsed.parts.keywordTags).toEqual([]);
    expect(parsed.parts.suggestedTags).toEqual(["#تصميم_مواقع", "#برمجة_مواقع", "#موقع_إلكتروني", "#CoderNation", "#websitedesign"]);
    expect(parsed.parts.timing).toContain("تخمين");
    expect(parsed.header.published).toBe("false");
  });

  it("word-count notes: both spellings, any digits, only at the end of a line", async () => {
    const { stripWordCountNotes } = await import("@/lib/script-math");
    expect(stripWordCountNotes("مرحبا بكم — ٣ كلمات")).toBe("مرحبا بكم");
    expect(stripWordCountNotes("مرحبا بكم (3 كلمات)")).toBe("مرحبا بكم");
    expect(stripWordCountNotes("سطر — 1 كلمة\nسطر تاني - 12 كلمات")).toBe("سطر\nسطر تاني");
    expect(stripWordCountNotes("لدينا 3 كلمات مهمة في الجملة")).toBe("لدينا 3 كلمات مهمة في الجملة"); // not at the end, not a note
    expect(stripWordCountNotes("ثلاث كلمات — بدون رقم")).toBe("ثلاث كلمات — بدون رقم");
  });
});
