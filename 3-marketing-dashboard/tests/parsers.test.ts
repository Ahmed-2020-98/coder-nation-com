import { describe, expect, it } from "vitest";
import { parseIdeas } from "@/server/parse/ideas";
import {
  countWords,
  describeDuration,
  parseScript,
  parseSpeakingRate,
  serializeScript,
  hasPlaceholders,
} from "@/server/parse/script";
import { parseMontage, parseTimeRange } from "@/server/parse/montage";
import { parsePost, serializePost } from "@/server/parse/post";
import { parseTable, setFrontmatter, splitFrontmatter, splitSections, toNumber } from "@/server/files/markdown";
import { IDEAS, IDEAS_BAD_SUM, MONTAGE, POST, SCRIPT } from "./fixtures";

describe("markdown helpers", () => {
  it("reads and updates frontmatter without touching the body", () => {
    const { fm, body } = splitFrontmatter(SCRIPT);
    expect(fm.status).toBe("awaiting_approval");
    const updated = setFrontmatter(SCRIPT, { status: "approved", selected_idea: "2" });
    const again = splitFrontmatter(updated);
    expect(again.fm.status).toBe("approved");
    expect(again.fm.selected_idea).toBe("2");
    expect(again.fm.slug).toBe("website-cost");
    expect(again.body).toBe(body);
  });

  it("parses tables and keeps escaped pipes inside a cell", () => {
    const table = parseTable("| a | b |\n|---|---|\n| x \\| y | 2 |");
    expect(table?.header).toEqual(["a", "b"]);
    expect(table?.rows[0]).toEqual(["x | y", "2"]);
  });

  it("reads Arabic-Indic digits", () => {
    expect(toNumber("٣٠٪")).toBe(30);
    expect(toNumber("1,200 كومنت")).toBe(1200);
    expect(toNumber(undefined)).toBeNull();
  });

  it("splits h2 sections but keeps h3 blocks inside them", () => {
    const { sections } = splitSections("# t\n\n## A\nx\n### sub\ny\n\n## B\nz");
    expect(sections.map((s) => s.heading)).toEqual(["A", "B"]);
    expect(sections[0].content).toContain("### sub");
  });
});

describe("parseIdeas", () => {
  const parsed = parseIdeas(IDEAS);

  it("reads the header, summary and every idea field", () => {
    expect(parsed.header.status).toBe("awaiting_approval");
    expect(parsed.summary).toMatchObject({ total: 20, classified: 18, unrelated: 2 });
    expect(parsed.ideas).toHaveLength(2);
    const [first, second] = parsed.ideas;
    expect(first).toMatchObject({
      no: 1,
      title: "كام سعر عمل موقع؟",
      question: "كام سعر عمل موقع لشركة صغيرة؟",
      questionRef: "C003",
      count: 8,
      percent: 40,
      likes: 120,
      hookIsDraft: true,
    });
    expect(first.hook).toBe("كام بيكلّف موقعك فعلًا؟");
    expect(second).toMatchObject({ no: 2, count: 6, percent: 30, likes: null, hookIsDraft: false });
    expect(second.trend).toContain("مؤكد");
  });

  it("reads the clusters table and the mapping size", () => {
    expect(parsed.clusters.map((c) => [c.id, c.count])).toEqual([
      ["K01", 8],
      ["K02", 6],
      ["K03", 4],
      ["K99", 2],
    ]);
    expect(parsed.mappingCount).toBe(3);
    expect(parsed.mapping[1]).toEqual({ id: "C002", text: "سعر الموقع | بالدولار؟", likes: 5, cluster: "K01" });
    expect(parsed.mapping[0]).toMatchObject({ id: "C001", likes: null, cluster: "K99" });
  });

  it("checks that the clusters add up to the total", () => {
    expect(parsed.sumCheck).toEqual({ ok: true, clusterSum: 20, total: 20 });
    expect(parsed.warnings).toEqual([]);
    const bad = parseIdeas(IDEAS_BAD_SUM);
    expect(bad.sumCheck.ok).toBe(false);
    expect(bad.warnings.join(" ")).toContain("لا يساوي");
  });

  it("never throws on junk and reports what is missing", () => {
    const junk = parseIdeas("hello\n\n## شيء\nمحتوى");
    expect(junk.ideas).toEqual([]);
    expect(junk.warnings.length).toBeGreaterThan(0);
    expect(junk.sumCheck.ok).toBeNull();
  });
});

describe("script", () => {
  it("parses the three spoken parts and keeps the extra section", () => {
    const parsed = parseScript(SCRIPT);
    expect(parsed.title).toBe("كام بيكلّف موقعك؟");
    expect(parsed.parts.hook).toBe("كام بيكلّف موقعك فعلًا؟");
    expect(parsed.parts.cta).toBe("ابعتلي رسالة وأقولك.");
    expect(parsed.parts.missing).toBe("نطاق السعر");
    expect(parsed.durationLine).toContain("المدة التقريبية");
  });

  it("counts spoken words only (placeholders and markdown symbols don't count)", () => {
    expect(countWords("واحد اثنين ثلاثة")).toBe(3);
    // the bracketed placeholder is not spoken, so only "الرقم" and "وبس" count
    expect(countWords("الرقم [يحدده صاحب المشروع: السعر] وبس")).toBe(2);
    expect(countWords("**مهم** — # نقطة")).toBe(2);
    expect(hasPlaceholders("x [يحدده صاحب المشروع: y]")).toBe(true);
  });

  it("estimates duration with the style's rate, or flags the 2.5 assumption", () => {
    const parts = { hook: "واحد اثنين ثلاثة أربعة خمسة", body: "كلمة ".repeat(20), cta: "" };
    const assumed = describeDuration(parts, null);
    expect(assumed).toMatchObject({ words: 25, rate: 2.5, rateIsAssumed: true, seconds: 10 });
    const fromStyle = describeDuration(parts, 5);
    expect(fromStyle).toMatchObject({ rate: 5, rateIsAssumed: false, seconds: 5 });
  });

  it("warns when the hook is longer than about 3 seconds", () => {
    expect(describeDuration({ hook: "كلمة ".repeat(12), body: "", cta: "" }, null).hookTooLong).toBe(true);
    expect(describeDuration({ hook: "كلمة ".repeat(6), body: "", cta: "" }, null).hookTooLong).toBe(false);
  });

  it("reads the speaking rate from script-style.md, only once it is filled in", () => {
    expect(parseSpeakingRate("- معدل الكلام (كلمة/ثانية):\n")).toBeNull();
    expect(parseSpeakingRate("- معدل الكلام (كلمة/ثانية): 2.8")).toBe(2.8);
    expect(parseSpeakingRate("- معدل الكلام (كلمة/ثانية): ٣")).toBe(3);
  });

  it("round-trips edits: new text in, duration line refreshed, header and other sections intact", () => {
    const edited = { hook: "جملة جديدة قصيرة", body: "محتوى جديد تمامًا هنا", cta: "تابعني" };
    const info = describeDuration(edited, null);
    const out = serializeScript(SCRIPT, edited, info);
    const parsed = parseScript(out);
    expect(parsed.parts).toMatchObject({ hook: edited.hook, body: edited.body, cta: edited.cta, missing: "نطاق السعر" });
    expect(parsed.header).toMatchObject({ slug: "website-cost", status: "awaiting_approval" });
    expect(parsed.durationLine).toContain(`~${info.seconds} ثانية`);
    expect(parsed.durationLine).toContain("معدّل من الـ Dashboard");
    expect(out.match(/المدة التقريبية/g)).toHaveLength(1);
  });
});

describe("montage", () => {
  it("reads time ranges written as clock times, plain seconds or Arabic digits", () => {
    expect(parseTimeRange("00:00–00:03")).toEqual({ start: 0, end: 3 });
    expect(parseTimeRange("00:03–00:20.5")).toEqual({ start: 3, end: 20.5 });
    expect(parseTimeRange("20.5–٣٠")).toEqual({ start: 20.5, end: 30 });
    expect(parseTimeRange("بدون توقيت")).toBeNull();
  });

  it("parses the timeline table with the nine fixed columns", () => {
    const parsed = parseMontage(MONTAGE);
    expect(parsed.timeline).toHaveLength(3);
    expect(parsed.timeline[0]).toMatchObject({ index: "1", cut: "قطع مباشر", effects: "Punch-in", broll: "—" });
    expect(parsed.timeline[2]).toMatchObject({ start: 20.5, end: 30 });
    expect(parsed.totalSeconds).toBe(30);
    expect(parsed.columns).toHaveLength(9);
    expect(parsed.sourceInfo).toContain("1080x1920");
  });

  it("reports a missing timeline instead of throwing", () => {
    expect(parseMontage("# x\n\n## ملاحظات وفجوات\nلا شيء").warnings).toContain("جدول الـ Timeline غير موجود");
  });
});

describe("post", () => {
  it("separates keyword hashtags from the agent's own suggestions", () => {
    const parsed = parsePost(POST);
    expect(parsed.parts.caption).toContain("كام بيكلّف موقعك");
    expect(parsed.parts.keywordTags).toEqual(["#تصميم_مواقع", "#برمجة"]);
    expect(parsed.parts.suggestedTags).toEqual(["#مشاريع_رقمية"]);
    expect(parsed.header.published).toBe("false");
  });

  it("writes edits back and keeps the status section", () => {
    const parsed = parsePost(POST);
    const out = serializePost(POST, { ...parsed.parts, caption: "كابشن جديد", keywordTags: ["برمجة", "#ويب"], suggestedTags: [] });
    const again = parsePost(out);
    expect(again.parts.caption).toBe("كابشن جديد");
    expect(again.parts.keywordTags).toEqual(["#برمجة", "#ويب"]);
    expect(again.parts.suggestedTags).toEqual([]);
    expect(again.statusText).toContain("لم يُنشر");
    expect(again.header.published).toBe("false");
  });
});
