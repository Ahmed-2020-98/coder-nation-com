import "server-only";
import { createHmac } from "node:crypto";
import type { LeadInput } from "./leads";

/**
 * Sends a copy of each new lead to the internal CRM (4-ops). Entirely optional and best-effort: with no
 * OPS_INTAKE_URL / OPS_INTAKE_SECRET it does nothing, and a failure never affects the visitor (the lead is already
 * saved here). The request is signed: `X-Signature: sha256=HMAC(secret, "<timestamp>.<body>")` + `X-Timestamp`.
 */

export function signBody(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export type ForwardResult = "skipped" | "sent" | "failed";

export async function forwardLeadToOps(lead: LeadInput & { id: string }, fetcher: typeof fetch = fetch): Promise<ForwardResult> {
  const url = process.env.OPS_INTAKE_URL?.trim();
  const secret = process.env.OPS_INTAKE_SECRET?.trim();
  if (!url || !secret || secret.length < 32) return "skipped";
  try {
    const body = JSON.stringify({ externalId: lead.id, name: lead.name, phone: lead.phone, email: lead.email, service: lead.service, message: lead.message });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Timestamp": timestamp, "X-Signature": signBody(secret, timestamp, body) },
      body,
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[ops-forward] rejected with status", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[ops-forward]", error instanceof Error ? error.message : error);
    return "failed";
  }
}
