"use server";

import { refresh, updateTag } from "next/cache";
import { isSectionId } from "@/lib/content-spec";
import { CONTENT_TAG, resetSection, saveSection, setSectionHidden, type SaveResult } from "@/server/content";
import { requireAdmin } from "@/server/session";

// Server Actions are public endpoints: every one starts with requireAdmin() and validates its own input.

/** Runs a change and, when it worked, makes the public page and the panel pick it up on their next render. */
async function apply(task: () => Promise<SaveResult>): Promise<SaveResult> {
  try {
    const result = await task();
    if (result.ok) {
      updateTag(CONTENT_TAG);
      refresh();
    }
    return result;
  } catch (error) {
    console.error("[content]", error instanceof Error ? error.message : error);
    return { ok: false, error: "تعذّر الحفظ (قاعدة البيانات)" };
  }
}

const unknownSection: SaveResult = { ok: false, error: "قسم غير معروف" };

export async function saveSectionAction(section: string, value: unknown): Promise<SaveResult> {
  await requireAdmin();
  return isSectionId(section) ? apply(() => saveSection(section, value)) : unknownSection;
}

export async function resetSectionAction(section: string): Promise<SaveResult> {
  await requireAdmin();
  return isSectionId(section) ? apply(() => resetSection(section)) : unknownSection;
}

export async function setSectionHiddenAction(section: string, hidden: boolean): Promise<SaveResult> {
  await requireAdmin();
  return isSectionId(section) ? apply(() => setSectionHidden(section, hidden === true)) : unknownSection;
}
