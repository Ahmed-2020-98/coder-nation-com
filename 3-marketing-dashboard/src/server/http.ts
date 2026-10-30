import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { isLocalHost } from "@/lib/host";
import { RunStartError } from "./agents/types";
import { ServiceError } from "./services/common";
import { UploadError } from "./files/uploads";

/**
 * Shared plumbing for every API route: local-only access, same-origin writes, validated JSON bodies and one
 * error shape ({ error, code }) that the browser can show as-is. Error text is already Arabic and secret-free.
 */

/** Blocks non-local Host headers (LAN access, DNS rebinding) and cross-site writes. Throws ServiceError(403). */
export function guard(request: Request): void {
  if (!isLocalHost(request.headers.get("host"))) throw new ServiceError(403, "الـ Dashboard متاح محليًا فقط");
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (!isLocalHost(originHost)) throw new ServiceError(403, "الطلب من مصدر غير مسموح");
    }
  }
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError(400, "الطلب مش JSON صالح");
  }
  return schema.parse(raw);
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

function failure(status: number, message: string, code?: string): NextResponse {
  return json({ error: message, code: code ?? `http_${status}` }, { status });
}

/** Wraps a route handler: runs the guard, then turns every known error into a clean JSON response. */
export function handle<C = unknown>(fn: (request: Request, context: C) => Promise<Response> | Response) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      guard(request);
      return await fn(request, context);
    } catch (error) {
      if (error instanceof ServiceError) return failure(error.status, error.message, error.code);
      if (error instanceof UploadError) return failure(error.status, error.message, "upload");
      if (error instanceof RunStartError) {
        return failure(error.code === "not_logged_in" ? 503 : 409, error.message, error.code);
      }
      if (error instanceof ZodError) {
        const fields = [...new Set(error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];
        return failure(400, `بيانات غير صالحة${fields.length ? `: ${fields.join("، ")}` : ""}`, "invalid");
      }
      console.error("[api]", error instanceof Error ? error.message : error);
      return failure(500, "حصل خطأ غير متوقع في السيرفر");
    }
  };
}
