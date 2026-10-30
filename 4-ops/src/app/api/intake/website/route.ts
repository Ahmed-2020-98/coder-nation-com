import { NextResponse } from "next/server";
import { intakeSecret } from "@/server/env";
import { MAX_BODY_BYTES, ingestWebsiteLead, intakeSchema, verifyIntake } from "@/server/intake";
import { hit } from "@/server/rate-limit";

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Receives a lead from the public website. Authenticated by an HMAC signature, not by a session (see src/server/intake.ts). */
export async function POST(request: Request) {
  const secret = intakeSecret();
  if (!secret) return reply(503, { error: "intake is not configured" });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return reply(413, { error: "too large" });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return reply(413, { error: "too large" });

  const verified = verifyIntake({ secret, timestamp: request.headers.get("x-timestamp"), signature: request.headers.get("x-signature"), rawBody });
  // One answer for every kind of failure: the caller learns nothing about what was wrong.
  if (!verified.ok) return reply(401, { error: "unauthorized" });

  try {
    if (!(await hit("intake", 600, 60)).allowed) return reply(429, { error: "slow down" });
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return reply(400, { error: "invalid json" });
    }
    const parsed = intakeSchema.safeParse(json);
    if (!parsed.success) return reply(400, { error: "invalid lead" });
    const { id, created } = await ingestWebsiteLead(parsed.data);
    return reply(200, { ok: true, id, created });
  } catch (error) {
    console.error("[intake]", error instanceof Error ? error.message : error);
    return reply(500, { error: "server error" });
  }
}
