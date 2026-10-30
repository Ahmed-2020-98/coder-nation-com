import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { EMAIL_RE, PHONE_RE, SERVICES, normalizePhone } from "@/lib/crm-rules";
import { createDeal } from "./crm";

/**
 * The public website forwards each new lead here. Requests carry `X-Timestamp` (unix seconds) and
 * `X-Signature: sha256=<hex>` = HMAC-SHA256(secret, `${timestamp}.${rawBody}`). Anything else is refused, and the
 * lead's own id makes a repeated delivery harmless (same deal back, nothing duplicated).
 */

export const MAX_SKEW_SECONDS = 5 * 60;
export const MAX_BODY_BYTES = 10_000;

export function signIntake(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export type Verification = { ok: true } | { ok: false; reason: "missing" | "stale" | "signature" };

export function verifyIntake(args: { secret: string; timestamp: string | null; signature: string | null; rawBody: string; nowMs?: number }): Verification {
  const { secret, timestamp, signature, rawBody } = args;
  if (!timestamp || !signature) return { ok: false, reason: "missing" };
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs((args.nowMs ?? Date.now()) / 1000 - seconds) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale" };
  const expected = Buffer.from(signIntake(secret, timestamp, rawBody));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "signature" };
  return { ok: true };
}

const optional = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

export const intakeSchema = z.object({
  externalId: z.string().trim().min(8).max(64),
  name: z.string().trim().min(2).max(120),
  phone: z.string().transform(normalizePhone).refine((v) => PHONE_RE.test(v)),
  email: optional(254).refine((v) => v === null || EMAIL_RE.test(v)),
  service: optional(80).transform((v) => (v && (SERVICES as readonly string[]).includes(v) ? v : null)),
  message: optional(2000),
});
export type IntakeLead = z.output<typeof intakeSchema>;

export async function ingestWebsiteLead(lead: IntakeLead): Promise<{ id: string; created: boolean }> {
  return createDeal(
    {
      title: `طلب من الموقع: ${lead.service ?? "استفسار عام"}`,
      service: lead.service,
      source: "website",
      externalId: `website:${lead.externalId}`,
      valueMinor: null,
      currency: null,
      ownerId: null,
      message: lead.message,
      client: { name: lead.name, phone: lead.phone, email: lead.email },
    },
    null,
  );
}
