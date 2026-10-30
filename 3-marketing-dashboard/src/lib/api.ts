/** Error thrown by every failed API call. `message` is Arabic and safe to show as-is. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit | null };

/** fetch wrapper: JSON in/out, never cached, and failures become ApiError with the server's message. */
export async function api<T>(url: string, options: Options = {}): Promise<T> {
  const { json, headers: extra, ...rest } = options;
  const headers = new Headers(extra);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers, body, cache: "no-store" });
  } catch {
    throw new ApiError("تعذّر الاتصال بالسيرفر. تأكد إنه شغّال.", 0, "network");
  }
  const data = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!response.ok) throw new ApiError(data?.error ?? "حصل خطأ غير متوقع", response.status, data?.code);
  return data as T;
}
