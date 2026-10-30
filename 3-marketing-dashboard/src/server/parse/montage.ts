import {
  findSection,
  normalizeDigits,
  parseTable,
  splitFrontmatter,
  splitSections,
  type Frontmatter,
} from "../files/markdown";

export type TimelineRow = {
  index: string;
  time: string;
  /** Seconds parsed from the time column, when it can be read (used to draw the timeline ruler). */
  start: number | null;
  end: number | null;
  source: string;
  cut: string;
  text: string;
  effects: string;
  audio: string;
  broll: string;
  note: string;
};

export type ParsedMontage = {
  header: Frontmatter;
  title: string;
  sourceInfo: string;
  timeline: TimelineRow[];
  /** Column titles exactly as the agent wrote them, so unusual tables still render. */
  columns: string[];
  notes: string;
  totalSeconds: number | null;
  warnings: string[];
};

/** "00:03.5" | "0:03" | "3.5" | "3" -> seconds */
function toSeconds(token: string): number | null {
  const clean = normalizeDigits(token).trim();
  const clock = clean.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const plain = clean.match(/^\d+(?:\.\d+)?$/);
  return plain ? Number(plain[0]) : null;
}

export function parseTimeRange(value: string): { start: number; end: number } | null {
  const tokens = normalizeDigits(value).match(/\d+:\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?/g);
  if (!tokens || tokens.length < 2) return null;
  const start = toSeconds(tokens[0]);
  const end = toSeconds(tokens[1]);
  return start !== null && end !== null && end >= start ? { start, end } : null;
}

export function parseMontage(text: string): ParsedMontage {
  const { fm, body } = splitFrontmatter(text);
  const { preamble, sections } = splitSections(body);
  const warnings: string[] = [];
  const title = (preamble.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();

  const timelineSection = findSection(sections, /Timeline/i);
  const table = timelineSection ? parseTable(timelineSection.content) : null;
  const timeline: TimelineRow[] = [];
  if (!table) {
    warnings.push("جدول الـ Timeline غير موجود");
  } else {
    for (const row of table.rows) {
      const range = parseTimeRange(row[1] ?? "");
      timeline.push({
        index: row[0] ?? "",
        time: row[1] ?? "",
        start: range?.start ?? null,
        end: range?.end ?? null,
        source: row[2] ?? "",
        cut: row[3] ?? "",
        text: row[4] ?? "",
        effects: row[5] ?? "",
        audio: row[6] ?? "",
        broll: row[7] ?? "",
        note: row[8] ?? "",
      });
    }
  }

  const ends = timeline.map((row) => row.end).filter((value): value is number => value !== null);
  return {
    header: fm,
    title,
    sourceInfo: findSection(sections, /معلومات الفيديو/)?.content ?? "",
    timeline,
    columns: table?.header ?? [],
    notes: findSection(sections, /ملاحظات/)?.content ?? "",
    totalSeconds: ends.length ? Math.max(...ends) : null,
    warnings,
  };
}
