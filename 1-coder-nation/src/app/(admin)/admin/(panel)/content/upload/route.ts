import { MAX_IMAGE_BYTES } from "@/lib/content-spec";
import { storeImage } from "@/server/media";
import { getAdmin } from "@/server/session";

const reply = (body: { id: string } | { error: string }, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Image upload for the content editor. It sits under /admin on purpose: that is the only path the session cookie is
 * sent to, and the panel's headers and the proxy's redirect apply. Answers JSON (not a redirect) so the form can show
 * the problem next to the field.
 */
export async function POST(request: Request) {
  if (!(await getAdmin())) return reply({ error: "الجلسة انتهت. سجّل دخول تاني وجرّب." }, 401);
  // Defence in depth on top of the SameSite=Strict cookie: a browser says where a request came from.
  const origin = request.headers.get("sec-fetch-site");
  if (origin && origin !== "same-origin") return reply({ error: "طلب مرفوض" }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) return reply({ error: "الصورة أكبر من 2 ميجا" }, 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return reply({ error: "طلب غير صالح" }, 400);
  }
  if (!(file instanceof File)) return reply({ error: "مفيش ملف مرفق" }, 400);

  try {
    const result = await storeImage(new Uint8Array(await file.arrayBuffer()));
    return result.ok ? reply({ id: result.id }) : reply({ error: result.error }, result.error.includes("أكبر") ? 413 : 400);
  } catch (error) {
    console.error("[upload]", error instanceof Error ? error.message : error);
    return reply({ error: "تعذّر حفظ الصورة (قاعدة البيانات)" }, 500);
  }
}
