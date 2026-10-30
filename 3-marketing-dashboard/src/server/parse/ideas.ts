import {
  findSection,
  normalizeDigits,
  parseTable,
  splitFrontmatter,
  splitSections,
  toNumber,
  type Frontmatter,
} from "../files/markdown";

export type Idea = {
  no: number;
  title: string;
  question: string;
  questionRef: string | null;
  count: number | null;
  percent: number | null;
  likes: number | null;
  fit: string;
  trend: string;
  hook: string;
  hookIsDraft: boolean;
};

export type Cluster = {
  id: string;
  topic: string;
  count: number;
  percent: number | null;
  likes: number | null;
  examples: string;
};

/** One row of the agent's "جدول التعيين": which cluster every comment was put in. */
export type MappedComment = { id: string; text: string; likes: number | null; cluster: string };

export type ParsedIdeas = {
  header: Frontmatter;
  title: string;
  summary: { total: number | null; classified: number | null; unrelated: number | null; lines: string[] };
  ideas: Idea[];
  excluded: string;
  clusters: Cluster[];
  /** Capped (see MAX_MAPPED): the UI only needs a few example comments per cluster. */
  mapping: MappedComment[];
  mappingCount: number;
  /** null = could not be checked (missing data); true/false = the agent's own sum rule held or broke. */
  sumCheck: { ok: boolean | null; clusterSum: number | null; total: number | null };
  warnings: string[];
};

const QUOTES = /^["'“”«»]+|["'“”«»]+$/g;
const MAX_MAPPED = 5000;

function fieldMap(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*:?\s*(.*)$/);
    if (match) fields.set(match[1].replace(/[:：]\s*$/, "").trim(), match[2].trim());
  }
  return fields;
}

function pick(fields: Map<string, string>, needle: string): string {
  for (const [key, value] of fields) if (key.includes(needle)) return value;
  return "";
}

function parseIdeaBlock(heading: string, content: string): Idea | null {
  const head = heading.match(/^(\d+)\s*[.\-)–]?\s*(.+)$/);
  if (!head) return null;
  const fields = fieldMap(content);

  const questionRaw = pick(fields, "السؤال");
  // A cluster of several comments is written as `"first?" (C001) — و"second?" (C002)` (seen in real agent output):
  // the first quoted comment is the representative question, with its own reference.
  const firstQuoted = questionRaw.match(/["“«]\s*([^"”»]+?)\s*["”»]\s*\(\s*(C\d+)\s*\)/i);
  const ref = firstQuoted ? [firstQuoted[0], firstQuoted[2]] : questionRaw.match(/\(\s*(C\d+)\s*\)\s*$/i);
  const question = firstQuoted ? firstQuoted[1].trim() : questionRaw.replace(/\(\s*C\d+\s*\)\s*$/i, "").trim().replace(QUOTES, "").trim();

  const repeat = pick(fields, "التكرار");
  const normalized = normalizeDigits(repeat);
  const count = toNumber(normalized);
  const percent = normalized.match(/\(\s*([\d.]+)\s*%\s*\)/);
  const likes = normalized.match(/لايكات\s*[:：]\s*([\d,.]+)/);

  const hookRaw = pick(fields, "Hook");
  const hookIsDraft = /مسودة قبل التدريب/.test(hookRaw);
  const hook = hookRaw.replace(/\(?\s*مسودة قبل التدريب\s*\)?/g, "").trim().replace(QUOTES, "").trim();

  return {
    no: Number(head[1]),
    title: head[2].trim(),
    question,
    questionRef: ref ? ref[1].toUpperCase() : null,
    count,
    percent: percent ? Number(percent[1]) : null,
    likes: likes ? toNumber(likes[1]) : null,
    fit: pick(fields, "مناسبة"),
    trend: pick(fields, "الترند"),
    hook,
    hookIsDraft,
  };
}

/**
 * Reads an ideas file written by research-agent (see .claude/agents/research-agent.md for the template).
 * Never throws on odd content: whatever cannot be read is reported in `warnings`, and the caller can fall
 * back to showing the raw markdown.
 */
export function parseIdeas(text: string): ParsedIdeas {
  const { fm, body } = splitFrontmatter(text);
  const warnings: string[] = [];

  // The "## أهم 5 أفكار" section contains "### N. title" sub-blocks, so split those out of the h2 content first.
  const { preamble, sections } = splitSections(body);
  const title = (preamble.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();

  const summarySection = findSection(sections, /ملخص/);
  const summaryLines = (summarySection?.content ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
  const totalsLine = normalizeDigits(summaryLines.find((line) => /إجمالي/.test(line)) ?? "");
  const total = toNumber(totalsLine.match(/إجمالي[^:：]*[:：]\s*([\d,]+)/)?.[1]);
  const classified = toNumber(totalsLine.match(/مصنّف\s*[:：]\s*([\d,]+)/)?.[1]);
  const unrelated = toNumber(totalsLine.match(/غير مرتبط\s*[:：]\s*([\d,]+)/)?.[1]);

  const ideas: Idea[] = [];
  const ideasSection = findSection(sections, /أهم|الأفكار/);
  if (ideasSection) {
    const blocks = ideasSection.content.split(/^###\s+/m).slice(1);
    for (const block of blocks) {
      const newline = block.indexOf("\n");
      const heading = (newline === -1 ? block : block.slice(0, newline)).trim();
      const content = newline === -1 ? "" : block.slice(newline + 1);
      // Real output also has un-numbered sub-blocks here (e.g. "### بدائل متعادلة" for tied runners-up): notes, not ideas.
      if (!/^\d/.test(normalizeDigits(heading))) continue;
      const idea = parseIdeaBlock(heading, content);
      if (idea) ideas.push(idea);
      else warnings.push(`تعذّر قراءة الفكرة: ${heading.slice(0, 40)}`);
    }
  } else {
    warnings.push("قسم أهم الأفكار غير موجود");
  }
  if (ideas.length === 0) warnings.push("لا توجد أفكار قابلة للقراءة");

  const clusters: Cluster[] = [];
  const clustersSection = findSection(sections, /clusters/i);
  const clustersTable = clustersSection ? parseTable(clustersSection.content) : null;
  if (clustersTable) {
    for (const row of clustersTable.rows) {
      const count = toNumber(row[2]);
      // Ids can come bold, and the agent closes the table with a totals row ("**المجموع** | | **12**") that must not
      // be counted as one more cluster (it made every sum check fail on the first real run).
      const id = (row[0] ?? "").replace(/[*_`]/g, "").trim();
      if (!id || count === null || /^(?:ال)?(?:مجموع|إجمالي)|^(?:total|sum)\b/i.test(id)) continue;
      clusters.push({
        id,
        topic: row[1] ?? "",
        count,
        percent: toNumber(row[3]),
        likes: toNumber(row[4]),
        examples: row[5] ?? "",
      });
    }
  } else {
    warnings.push("جدول الـ clusters غير موجود");
  }

  const mappingSection = findSection(sections, /التعيين/);
  const mappingTable = mappingSection ? parseTable(mappingSection.content) : null;
  const mappedRows = mappingTable ? mappingTable.rows.filter((row) => /^C\d+$/i.test(row[0] ?? "")) : [];
  const mappingCount = mappedRows.length;
  const mapping: MappedComment[] = mappedRows.slice(0, MAX_MAPPED).map((row) => ({
    id: row[0].toUpperCase(),
    text: row[1] ?? "",
    likes: toNumber(row[2]),
    cluster: (row[3] ?? "").trim(),
  }));

  const clusterSum = clusters.length ? clusters.reduce((sum, cluster) => sum + cluster.count, 0) : null;
  const reference = total ?? (mappingCount > 0 ? mappingCount : null);
  const sumOk = clusterSum !== null && reference !== null ? clusterSum === reference : null;
  if (sumOk === false) {
    warnings.push(`مجموع الـ clusters (${clusterSum}) لا يساوي إجمالي الكومنتات (${reference})`);
  }

  const excludedSection = findSection(sections, /مستبعد/);

  return {
    header: fm,
    title,
    summary: { total, classified, unrelated, lines: summaryLines },
    ideas,
    excluded: excludedSection?.content ?? "",
    clusters,
    mapping,
    mappingCount,
    sumCheck: { ok: sumOk, clusterSum, total: reference },
    warnings,
  };
}
