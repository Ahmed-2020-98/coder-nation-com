"use server";

import { content } from "@/content";
import { createLead, parseLeadInput, type LeadInput } from "@/server/leads";
import { forwardLeadToOps } from "@/server/ops-forward";
import { hit } from "@/server/rate-limit";
import { clientFingerprint } from "@/server/request";

const { failure } = content.contact.form;

export type SubmitLeadResult =
  | { ok: true }
  | { ok: false; error: string; reason: "invalid" | "limited" | "server"; fieldErrors?: Partial<Record<keyof LeadInput, string>> };

const SUBMIT_LIMIT = { attempts: 5, windowSeconds: 60 * 60 };

/**
 * The public contact form. Everything the browser checked is checked again here, because the browser is the one
 * place a stranger fully controls. Nothing from the request is trusted except what survives the schema.
 */
export async function submitLead(formData: FormData): Promise<SubmitLeadResult> {
  // Bots fill every field; people never see this one. Pretend it worked so they don't adapt.
  if (String(formData.get("website") ?? "") !== "") return { ok: true };

  const parsed = parseLeadInput(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, reason: "invalid", error: content.contact.form.errors.summaryTitle, fieldErrors: parsed.fieldErrors };

  try {
    const { ipHash, userAgent } = await clientFingerprint();
    const rate = await hit(`lead:${ipHash}`, SUBMIT_LIMIT.attempts, SUBMIT_LIMIT.windowSeconds);
    if (!rate.allowed) return { ok: false, reason: "limited", error: failure.tooMany };
    const id = await createLead(parsed.data, { ipHash, userAgent });
    // A copy for the internal CRM. Best-effort: never makes the visitor's request fail (see ops-forward.ts).
    await forwardLeadToOps({ ...parsed.data, id });
    return { ok: true };
  } catch (error) {
    // Never echo database details to a visitor; the server log has them.
    console.error("[submitLead]", error instanceof Error ? error.message : error);
    return { ok: false, reason: "server", error: failure.server };
  }
}
