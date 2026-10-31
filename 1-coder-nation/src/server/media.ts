import "server-only";
import { randomUUID } from "node:crypto";
import { UUID_RE } from "@/lib/content-model";
import { MAX_IMAGE_BYTES } from "@/lib/content-spec";
import { sql } from "./db";

// Uploaded images live in the `media` table (see db/migrations/002_media.sql). Only raster formats are accepted and the
// type is decided by the file's first bytes, never by the name or the type the browser claims: an upload that is not
// really a JPEG/PNG/WebP is refused, and SVG (which can carry script) is not on the list at all.

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Everything stored in `media` together. Uploads are refused beyond this so the database cannot be filled from the panel. */
export const MAX_TOTAL_MEDIA_BYTES = 150 * 1024 * 1024;

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, i) => bytes[i] === byte)) return "image/png";
  const ascii = (from: number, text: string) => text.split("").every((char, i) => bytes[from + i] === char.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

export type StoreResult = { ok: true; id: string } | { ok: false; error: string };

export async function storeImage(bytes: Uint8Array): Promise<StoreResult> {
  if (bytes.byteLength === 0) return { ok: false, error: "الملف فاضي" };
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "الصورة أكبر من 2 ميجا" };
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, error: "نوع الملف غير مدعوم (JPG أو PNG أو WebP بس)" };

  const db = sql();
  const [{ total }] = await db<{ total: string }[]>`select coalesce(sum(size_bytes), 0) as total from media`;
  if (Number(total) + bytes.byteLength > MAX_TOTAL_MEDIA_BYTES) return { ok: false, error: "مساحة الصور امتلأت. شيل صور قديمة أو صغّر الأحجام." };

  const id = randomUUID();
  await db`insert into media (id, mime, data, size_bytes) values (${id}, ${mime}, ${Buffer.from(bytes)}, ${bytes.byteLength})`;
  return { ok: true, id };
}

export async function getImage(id: string): Promise<{ mime: ImageMime; data: Buffer } | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await sql()<{ mime: ImageMime; data: Buffer }[]>`select mime, data from media where id = ${id}`;
  return row ?? null;
}

/**
 * Deletes uploaded images nothing points at any more (replaced, removed, or uploaded and never saved). Images younger
 * than `graceMinutes` are kept: they may belong to a form that is still open and has not been saved yet.
 */
export async function purgeOrphanMedia(referenced: ReadonlySet<string>, graceMinutes = 60): Promise<number> {
  const db = sql();
  const old = await db<{ id: string }[]>`select id from media where created_at < now(3) - interval ${graceMinutes} minute`;
  const doomed = old.map((row) => row.id).filter((id) => !referenced.has(id.toLowerCase()));
  if (doomed.length === 0) return 0;
  await db`delete from media where id in ${db.list(doomed)}`;
  return doomed.length;
}
