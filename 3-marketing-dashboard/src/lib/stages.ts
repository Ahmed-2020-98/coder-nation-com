// Shared (client + server) vocabulary for the content pipeline.

export const STAGES = ["idea", "script", "filming", "ready", "published"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  idea: "فكرة",
  script: "سكريبت",
  filming: "تصوير / مونتاج",
  ready: "جاهز للنشر",
  published: "منشور",
};

export function previousStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i > 0 ? STAGES[i - 1] : null;
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

export type RunKind = "research" | "script" | "script_edit" | "shotlist" | "montage" | "posting";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export const RUN_KIND_LABEL: Record<RunKind, string> = {
  research: "تحليل الكومنتات",
  script: "كتابة السكريبت",
  script_edit: "تعديل السكريبت بالـ AI",
  shotlist: "Shot list",
  montage: "خطة المونتاج",
  posting: "تجهيز البوست",
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: "في الانتظار",
  running: "شغّال",
  succeeded: "تم",
  failed: "فشل",
  cancelled: "اتلغى",
};

export type RunStep = { at: string; label: string };

/** Slug rule shared by the UI and the API: lowercase latin words joined by "-" (3–60 chars). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isValidSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 60 && SLUG_PATTERN.test(value);
}

export type StyleName = "script-style" | "montage-style";
export const STYLE_LABEL: Record<StyleName, string> = {
  "script-style": "أسلوب السكريبت",
  "montage-style": "طريقة المونتاج",
};
