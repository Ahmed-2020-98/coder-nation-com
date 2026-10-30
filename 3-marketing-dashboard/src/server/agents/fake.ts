import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { atomicWrite } from "../files/markdown";
import { agentPath, todayISO } from "../paths";
import type { AgentJob, Runner, RunnerResult } from "./types";

/**
 * DEV-ONLY simulator (FAKE_AGENT_RUNS=1, never active in production). It produces files in the same templates the
 * real agents are told to write, so the Dashboard's loading, success and parsing paths can be exercised without
 * spending API money. Output is clearly marked `simulated: true`. It says NOTHING about how well the real agents
 * cluster, write or plan: that can only be checked with a real API key.
 */

const run = promisify(execFile);
const SIM_HEADER = "simulated: true";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });
}

const SERVICES = {
  web: "تصميم وبرمجة المواقع",
  mobile: "تطبيقات الموبايل (Flutter)",
  store: "المتاجر الإلكترونية",
};

type ClusterDef = { id: string; topic: string; test: RegExp; fit: string; hook: string };
const CLUSTERS: ClusterDef[] = [
  { id: "K01", topic: "كام سعر عمل موقع؟", test: /سعر|بكام|تكلفة|ثمن|كام/, fit: `نعم — ${SERVICES.web}`, hook: "كام بتكلّف فعلًا عمل موقع لشركتك؟" },
  { id: "K02", topic: "هل بتعملوا تطبيقات Flutter؟", test: /flutter|فلاتر|تطبيق/i, fit: `نعم — ${SERVICES.mobile}`, hook: "تطبيق للـ iOS والـ Android بكود واحد؟ ده ممكن" },
  { id: "K03", topic: "ينفع متجر إلكتروني؟", test: /متجر|شوبيفاي|shopify|ستور/i, fit: `نعم — ${SERVICES.store}`, hook: "متجر إلكتروني من الصفر ولا على منصة جاهزة؟" },
  { id: "K04", topic: "المشروع بياخد وقت قد إيه؟", test: /مدة|وقت|يستغرق|بياخد/, fit: `نعم — ${SERVICES.web}`, hook: "كام أسبوع بيحتاج موقعك عشان يتسلّم؟" },
  { id: "K05", topic: "إزاي أبدأ وأتواصل؟", test: /ابدأ|تواصل|رقم|واتساب/, fit: "جزئي — لا ترتبط بخدمة محددة", hook: "عايز تبدأ مشروعك؟ ده أول خطوة" },
];
const OTHER_ID = "K99";

function parseCommentLine(line: string): { text: string; likes: number | null } {
  const match = line.match(/^(.*)\|\s*(\d+)\s*$/);
  return match ? { text: match[1].trim(), likes: Number(match[2]) } : { text: line.trim(), likes: null };
}

function researchFile(commentsFile: string, batch: string, date: string): string {
  const lines = fs
    .readFileSync(agentPath(commentsFile), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = lines.map((line, i) => {
    const { text, likes } = parseCommentLine(line);
    const cluster = CLUSTERS.find((c) => c.test.test(text))?.id ?? OTHER_ID;
    return { id: `C${String(i + 1).padStart(3, "0")}`, text, likes, cluster };
  });
  const total = rows.length;
  const stats = [...CLUSTERS.map((c) => ({ ...c })), { id: OTHER_ID, topic: "غير مرتبط", fit: "", hook: "", test: /$^/ }].map((c) => {
    const members = rows.filter((row) => row.cluster === c.id);
    const likes = members.some((m) => m.likes !== null) ? members.reduce((sum, m) => sum + (m.likes ?? 0), 0) : null;
    return { ...c, members, count: members.length, likes };
  });
  const top = stats
    .filter((c) => c.id !== OTHER_ID && c.count > 0 && !c.fit.startsWith("جزئي"))
    .concat(stats.filter((c) => c.id !== OTHER_ID && c.count > 0 && c.fit.startsWith("جزئي")))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const classified = total - (stats.find((s) => s.id === OTHER_ID)?.count ?? 0);

  const ideas = top
    .map((c, i) => {
      const sample = c.members[0];
      return [
        `### ${i + 1}. ${c.topic}`,
        `- **السؤال الأصلي (حرفي):** "${sample.text}" (${sample.id})`,
        `- **التكرار:** ${c.count} كومنت (${pct(c.count)}%) | لايكات: ${c.likes ?? "—"}`,
        `- **مناسبة الخدمة:** ${c.fit}`,
        `- **الترند:** لا يوجد`,
        `- **Hook مقترح:** "${c.hook}" (مسودة قبل التدريب)`,
      ].join("\n");
    })
    .join("\n\n");

  const clusterRows = stats
    .filter((c) => c.count > 0)
    .map((c) => `| ${c.id} | ${c.topic} | ${c.count} | ${pct(c.count)} | ${c.likes ?? "—"} | ${c.members.slice(0, 3).map((m) => m.id).join(", ")} |`)
    .join("\n");
  const mapping = rows.map((r) => `| ${r.id} | ${r.text.replace(/\|/g, "\\|")} | ${r.likes ?? "—"} | ${r.cluster} |`).join("\n");

  return `---
stage: research
status: awaiting_approval
pre_training: true
created: ${date}
batch: ${batch}
${SIM_HEADER}
---
# أفكار الفيديو — ${batch}

## ملخص الدفعة
- إجمالي الكومنتات: ${total} | مصنّف: ${classified} | غير مرتبط: ${total - classified} (${classified} + ${total - classified} = ${total} ✔)
- الترندات المؤكدة: لا يوجد ترند مؤكد (محاكاة)

## أهم 5 أفكار
${ideas}

## مستبعد لعدم مناسبة الخدمات
لا يوجد

## كل الـ clusters
| ID | السؤال/الموضوع | العدد | % | لايكات | أمثلة (IDs) |
|---|---|---|---|---|---|
${clusterRows}

## جدول التعيين
| ID | الكومنت | لايكات | cluster |
|---|---|---|---|
${mapping}
`;
}

function scriptFile(slug: string, date: string, question: string, extraNote?: string): string {
  const hook = `${question.replace(/[؟?]+$/, "")}؟ خلّيني أجاوبك في دقيقة.`;
  const body = [
    "الموضوع ده بيتغيّر من مشروع للتاني، لكن فيه ثلاث حاجات بتحدد الإجابة.",
    "أولًا: حجم المشروع وعدد الصفحات أو الشاشات.",
    "ثانيًا: مدى التخصيص في التصميم.",
    "ثالثًا: المزايا المطلوبة. وبالنسبة للسعر: [يحدده صاحب المشروع: نطاق السعر]",
    extraNote ? `(نسخة معدّلة بناءً على الملاحظات: ${extraNote.slice(0, 120)})` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const cta = "لو عايز تعرف سعر مشروعك بالظبط، ابعتلي رسالة.";
  const words = [hook, body, cta].join(" ").replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length;
  return `---
stage: script
status: awaiting_approval
pre_training: true
created: ${date}
slug: ${slug}
${SIM_HEADER}
---
# ${question}

**المدة التقريبية:** ~${Math.round(words / 2.5)} ثانية (${words} كلمة ÷ 2.5 كلمة/ث، المعدل: افتراض مؤقت 2.5)

## Hook (0–3ث)
${hook}

## المحتوى
${body}

## CTA
${cta}

## معلومات ناقصة
نطاق السعر
`;
}

async function probeDuration(video: string): Promise<number | null> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function extractFrames(video: string, slug: string, duration: number): Promise<number> {
  const dir = agentPath("marketing", "outputs", "montage", slug, "frames");
  fs.mkdirSync(dir, { recursive: true });
  let made = 0;
  for (const fraction of [0.05, 0.3, 0.55, 0.8]) {
    const second = Math.max(0, Math.round(duration * fraction * 10) / 10);
    try {
      await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(second), "-i", video, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", path.join(dir, `at_${second}.jpg`)]);
      made++;
    } catch {
      /* frame extraction is decorative in simulation mode */
    }
  }
  return made;
}

async function montageFile(slug: string, date: string, video: string, scriptRel: string): Promise<string> {
  const duration = (await probeDuration(video)) ?? 30;
  await extractFrames(video, slug, duration);
  const cut = (n: number) => Math.round(duration * n * 10) / 10;
  const fmt = (n: number) => `00:${String(Math.floor(n)).padStart(2, "0")}`;
  const rows = [
    [0, 0.12, "Hook", "قطع مباشر", "عنوان الفكرة", "Punch-in خفيف", "موسيقى منخفضة", "—"],
    [0.12, 0.7, "المحتوى", "Jump cut عند كل سكتة", "النقاط الثلاث", "—", "موسيقى منخفضة", "لقطة شاشة"],
    [0.7, 1, "CTA", "قطع بسيط", "رقم التواصل", "—", "موسيقى + SFX نهاية", "—"],
  ];
  const table = rows
    .map((r, i) => `| ${i + 1} | ${fmt(cut(r[0] as number))}–${fmt(cut(r[1] as number))} | ${r[2]} (${fmt(cut(r[0] as number))}–${fmt(cut(r[1] as number))}) | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | |`)
    .join("\n");
  return `---
stage: montage
status: awaiting_approval
pre_training: true
created: ${date}
slug: ${slug}
script_ref: ${scriptRel}
footage: ${video}
${SIM_HEADER}
---
# خطة المونتاج — ${slug}

## معلومات الفيديو المصدر
المدة ${duration.toFixed(1)} ث | عدد القطعات المكتشفة: محاكاة

## Timeline
| # | الوقت في الفيديو النهائي | المصدر (in–out بالثواني) | القطع/الانتقال | النص على الشاشة | المؤثرات | الموسيقى/SFX | B-roll | ملاحظة |
|---|---|---|---|---|---|---|---|---|
${table}

## ملاحظات وفجوات
محاكاة: الخطة لم تُبنَ على تحليل حقيقي للفيديو.
`;
}

function postFile(slug: string, date: string, scriptRel: string): string {
  return `---
stage: posting
status: awaiting_approval
pre_training: true
created: ${date}
slug: ${slug}
script_ref: ${scriptRel}
published: false
${SIM_HEADER}
---
# بوست TikTok — ${slug}

## الكابشن
كام بيكلّف مشروعك الرقمي فعلًا؟ ثلاث حاجات بتحدد الإجابة. ابعتلي رسالة وأقولك. (محاكاة)

## الهاشتاجات
- من الكلمات المفتاحية: #تصميم_مواقع #برمجة
- مقترحة (غير موثّقة): #مشاريع_رقمية #ريادة_أعمال

## وقت النشر المقترح
الثلاثاء 8 مساءً. الأساس: تقدير عام غير مبني على بيانات حسابك

## حالة النشر
لم يُنشر. النشر بموافقة صاحب المشروع الصريحة وبإيده.
`;
}

function shotListText(slug: string): string {
  return `| # | الجزء | الكلام المنطوق | وصف اللقطة | مدة تقريبية (ث) | ملاحظات |
|---|---|---|---|---|---|
| 1 | Hook | السؤال الأصلي | وش المتكلم قريب، نظرة للكاميرا | 3 | مسودة قبل التدريب |
| 2 | المحتوى | النقاط الثلاث | لقطة شاشة توضح كل نقطة | 18 | محاكاة |
| 3 | CTA | ابعتلي رسالة | وش المتكلم مع إشارة | 4 | محاكاة |

إجمالي المدة التقريبية: 25 ثانية (${slug})`;
}

export const runFake: Runner = async function* (job: AgentJob, signal: AbortSignal) {
  const sim = job.simulate ?? {};
  const date = todayISO();
  const output = typeof sim.output === "string" ? sim.output : null;
  const pause = () => sleep(650, signal);

  const steps: Record<string, string[]> = {
    research: ["قراءة ملف الكومنتات", "تجميع الكومنتات المتشابهة", "عدّ التكرار", "بحث ويب: ترندات المجال", "كتابة ملف الأفكار"],
    script: ["قراءة الفكرة المعتمدة", "قراءة script-style.md", "كتابة السكريبت"],
    script_edit: ["قراءة النسخة الحالية", "تطبيق الملاحظات", "كتابة نسخة جديدة"],
    shotlist: ["قراءة السكريبت", "تقسيم المقاطع"],
    montage: ["قراءة معلومات الفيديو (ffprobe)", "كشف نقاط القطع", "استخراج فريمات من الفيديو", "كتابة خطة المونتاج"],
    posting: ["قراءة السكريبت وخطة المونتاج", "كتابة الكابشن والهاشتاجات"],
  };
  for (const label of steps[job.kind] ?? []) {
    if (signal.aborted) return { ok: false, text: "", costUsd: null, error: "اتلغى التشغيل" } satisfies RunnerResult;
    yield { type: "step", label };
    await pause();
  }

  try {
    let content = "";
    let text = "تمت المحاكاة.";
    switch (job.kind) {
      case "research":
        content = researchFile(String(sim.commentsFile), String(sim.batch), date);
        break;
      case "script":
        content = scriptFile(String(sim.slug), date, String(sim.question ?? "سؤال المشاهد"));
        break;
      case "script_edit":
        content = scriptFile(String(sim.slug), date, "نسخة معدّلة", String(sim.notes ?? ""));
        break;
      case "montage":
        content = await montageFile(String(sim.slug), date, String(sim.footage), String(sim.script));
        break;
      case "posting":
        content = postFile(String(sim.slug), date, String(sim.script));
        break;
      case "shotlist":
        text = shotListText(String(sim.slug));
        break;
    }
    if (output && content) atomicWrite(agentPath(output), content);
    return { ok: true, text, costUsd: 0 };
  } catch (error) {
    return { ok: false, text: "", costUsd: null, error: `فشلت المحاكاة: ${error instanceof Error ? error.message : String(error)}` };
  }
};
