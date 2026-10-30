import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../env";
import { assertInside, dataPath } from "../paths";

export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"] as const;

export class UploadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function footageDir(cardId: string): string {
  return dataPath("footage", cardId);
}

/**
 * Streams the request body to disk without buffering it in memory. The stored name is random, so nothing the user
 * typed (file name included) reaches a path, a prompt or a shell. Aborts and cleans up when the size limit is hit.
 */
export async function saveFootage(
  cardId: string,
  body: ReadableStream<Uint8Array> | null,
  originalName: string,
  declaredLength: number | null,
): Promise<{ name: string; absolute: string; bytes: number }> {
  if (!body) throw new UploadError(400, "لا يوجد ملف في الطلب");
  const extension = path.extname(originalName).toLowerCase();
  if (!(VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new UploadError(415, `الصيغ المدعومة: ${VIDEO_EXTENSIONS.join(" ")}`);
  }
  if (declaredLength !== null && declaredLength > env.maxUploadBytes) {
    throw new UploadError(413, `الملف أكبر من الحد المسموح (${Math.round(env.maxUploadBytes / 1024 / 1024)} MB)`);
  }

  const dir = footageDir(cardId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${randomUUID()}${extension}`;
  const absolute = assertInside(dir, path.join(dir, name));
  const temp = `${absolute}.part`;

  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > env.maxUploadBytes) callback(new UploadError(413, "الملف أكبر من الحد المسموح"));
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body as never), limiter, fs.createWriteStream(temp));
    if (bytes === 0) throw new UploadError(400, "الملف فاضي");
    fs.renameSync(temp, absolute);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error instanceof UploadError ? error : new UploadError(500, "تعذّر حفظ الملف");
  }
  return { name, absolute, bytes };
}

/** Removes every file in the card's footage folder except `keep` (one footage file per card). */
export function pruneFootage(cardId: string, keep: string): void {
  const dir = footageDir(cardId);
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry !== keep) fs.rmSync(path.join(dir, entry), { force: true });
  }
}
