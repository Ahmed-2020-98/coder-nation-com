import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { ipSalt } from "./env";

/**
 * A short keyed hash of the caller's IP: good enough to rate-limit and to spot repeats, but the address itself is never
 * stored. Behind a proxy the first X-Forwarded-For entry is used (Vercel sets it itself; any other proxy must too).
 */
export async function clientFingerprint(): Promise<{ ipHash: string; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;
  return { ipHash: createHmac("sha256", ipSalt()).update(ip).digest("hex").slice(0, 32), userAgent };
}
