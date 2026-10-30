import { AGENT_DIRS } from "../paths";
import type { AgentJob } from "./types";

/**
 * Prompts the Dashboard sends. The agents' own behaviour (clustering, style rules, ffmpeg recipes, headers) lives in
 * `.claude/agents/*.md` and stays there; these only say WHAT to work on, WHERE to write, and that a human gate exists.
 */

const PREAMBLE = [
  "تشغيل من الـ Dashboard (مش من الـ terminal): نفّذ مرحلتك فقط وسلّم النتيجة في الملف المحدد.",
  "- ما تسألش عن موافقة ولا تنتظر ردًا: الـ Dashboard هو اللي بياخد موافقة صاحب المشروع.",
  "- ما تعدّل ملفات marketing/style أو marketing/inputs أبدًا، وما تنتقل لمرحلة تانية.",
  "- اكتب ملف المخرج في المسار المحدد بالظبط، بنفس القالب والـ header المذكورين في تعريفك (status: awaiting_approval).",
  "- بعد ما تخلّص ردّ برسالة قصيرة بالعربي: مسار الملف + ملخص من سطرين.",
].join("\n");

export function researchJob(input: { commentsFile: string; batch: string; date: string }): AgentJob {
  const expectedOutput = `${AGENT_DIRS.ideas}/${input.date}-${input.batch}.md`;
  return {
    kind: "research",
    agent: "research-agent",
    expectedOutput,
    prompt: [
      PREAMBLE,
      "",
      "المرحلة: Research",
      `ملف الكومنتات: ${input.commentsFile}`,
      `batch: ${input.batch}`,
      `تاريخ اليوم: ${input.date}`,
      `الكلمات المفتاحية والترندات اللي بعتها المستخدم: marketing/inputs/keywords.md`,
      `ملف المخرج المطلوب: ${expectedOutput}`,
    ].join("\n"),
    simulate: { commentsFile: input.commentsFile, batch: input.batch, date: input.date, output: expectedOutput },
  };
}

export function scriptJob(input: {
  ideasFile: string;
  ideaNo: number;
  slug: string;
  date: string;
  question: string;
}): AgentJob {
  const expectedOutput = `${AGENT_DIRS.scripts}/${input.date}-${input.slug}.md`;
  return {
    kind: "script",
    agent: "script-agent",
    expectedOutput,
    prompt: [
      PREAMBLE,
      "",
      "المرحلة: Script",
      `ملف الأفكار المعتمد: ${input.ideasFile}`,
      `رقم الفكرة المختارة: ${input.ideaNo}`,
      `slug: ${input.slug}`,
      `تاريخ اليوم: ${input.date}`,
      `ملف المخرج المطلوب: ${expectedOutput}`,
    ].join("\n"),
    simulate: { slug: input.slug, date: input.date, output: expectedOutput, question: input.question },
  };
}

export function scriptEditJob(input: {
  previousFile: string;
  slug: string;
  date: string;
  version: number;
  notes: string;
}): AgentJob {
  const expectedOutput = `${AGENT_DIRS.scripts}/${input.date}-${input.slug}-v${input.version}.md`;
  return {
    kind: "script_edit",
    agent: "script-agent",
    expectedOutput,
    prompt: [
      PREAMBLE,
      "",
      "المرحلة: Script (مراجعة)",
      `السكريبت الحالي: ${input.previousFile}`,
      `slug: ${input.slug}`,
      `تاريخ اليوم: ${input.date}`,
      `احفظ النسخة الجديدة كملف جديد (من غير ما تمسح القديم): ${expectedOutput}`,
      "ملاحظات صاحب المشروع (نفّذها بالنص، وما تغيّرش حاجة ما اتطلبتش):",
      input.notes.trim(),
    ].join("\n"),
    simulate: { slug: input.slug, date: input.date, output: expectedOutput, previous: input.previousFile, notes: input.notes },
  };
}

export function montageJob(input: { scriptFile: string; footagePath: string; footageDir: string; slug: string; date: string }): AgentJob {
  const expectedOutput = `${AGENT_DIRS.montage}/${input.date}-${input.slug}.md`;
  return {
    kind: "montage",
    agent: "montage-agent",
    expectedOutput,
    extraDirs: [input.footageDir],
    prompt: [
      PREAMBLE,
      "",
      "المرحلة: Montage",
      `السكريبت المعتمد: ${input.scriptFile}`,
      `مسار الفيديو المتصور (للقراءة فقط، ما تعدّلوش): ${input.footagePath}`,
      `slug: ${input.slug}`,
      `تاريخ اليوم: ${input.date}`,
      `ملف المخرج المطلوب: ${expectedOutput}`,
      // Real runs were refused when the agent wrote absolute paths or `cd`'d first: the permission rules are for the
      // relative form, so say so up front.
      "ملاحظة تشغيل: مجلد العمل الحالي هو جذر المشروع. استخدم مسارات نسبية منه (marketing/outputs/montage/<slug>/frames/...) لأي mkdir وأي ملف ناتج من ffmpeg، ومتعملش cd. مسار الفيديو وحده مطلق: اكتبه كامل بين علامات تنصيص في كل أمر، ومتحطوش في متغيّر shell (V=... أو export) لأن الأمر بيتمنع وتضيع عليك تحليلات القطعات والسكتات.",
    ].join("\n"),
    simulate: { slug: input.slug, date: input.date, output: expectedOutput, footage: input.footagePath, script: input.scriptFile },
  };
}

export function postingJob(input: {
  scriptFile: string;
  montageFile: string;
  finalVideoPath: string | null;
  slug: string;
  date: string;
}): AgentJob {
  const expectedOutput = `${AGENT_DIRS.posts}/${input.date}-${input.slug}.md`;
  return {
    kind: "posting",
    agent: "posting-agent",
    expectedOutput,
    prompt: [
      PREAMBLE,
      "",
      "المرحلة: Posting",
      `السكريبت المعتمد: ${input.scriptFile}`,
      `خطة المونتاج المعتمدة: ${input.montageFile}`,
      `الفيديو النهائي: ${input.finalVideoPath ?? "غير محدد بعد"}`,
      `slug: ${input.slug}`,
      `تاريخ اليوم: ${input.date}`,
      "ملاحظة: النشر الفعلي يتم يدويًا من صاحب المشروع، وإنت مبتنشرش أي حاجة.",
      `ملف المخرج المطلوب: ${expectedOutput}`,
    ].join("\n"),
    simulate: { slug: input.slug, date: input.date, output: expectedOutput, script: input.scriptFile },
  };
}

const SHOT_LIST_SYSTEM = [
  "أنت مساعد داخل Dashboard التسويق لشركة Coder Nation. شغلك الوحيد: تحويل سكريبت فيديو TikTok إلى Shot list للتصوير.",
  "",
  "القواعد:",
  "- اقرأ السكريبت من المسار المعطى، واقرأ marketing/style/montage-style.md لو فيه معلومات عن الـ B-roll أو اللقطات.",
  "- تقسّم السكريبت لجمل أو مقاطع قصيرة، ولكل مقطع لقطة واحدة أو أكتر.",
  "- ممنوع تخترع أسلوب تصوير أو مونتاج أو معلومات عن الخدمات. لو montage-style.md فاضي اكتب لقطات عامة بسيطة (وش المتكلم، لقطة شاشة، لقطة توضيحية) وعلّمها مسودة قبل التدريب.",
  "- لا تعدّل أي ملف: رجّع النتيجة كنص markdown فقط.",
  "",
  "المخرج: جدول markdown بالأعمدة دي بالترتيب:",
  "| # | الجزء (Hook / المحتوى / CTA) | الكلام المنطوق | وصف اللقطة | مدة تقريبية (ث) | ملاحظات |",
  "ثم سطر أخير: إجمالي المدة التقريبية. بالعربي، ومصطلحات تقنية بالإنجليزي، ومن غير مقدمات.",
].join("\n");

export function shotListJob(input: { scriptFile: string; slug: string }): AgentJob {
  return {
    kind: "shotlist",
    agent: null,
    systemPrompt: SHOT_LIST_SYSTEM,
    prompt: `السكريبت: ${input.scriptFile}\nslug: ${input.slug}\nاعمل الـ Shot list.`,
    simulate: { slug: input.slug, script: input.scriptFile },
  };
}
