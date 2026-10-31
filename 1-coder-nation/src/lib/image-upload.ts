// Browser side of the image upload in the content editor: shrink the picture first (a phone photo is several MB and
// the card shows it a few hundred pixels wide), then send it to /admin/content/upload. The server checks everything
// again; this only saves bandwidth and keeps the page fast.

import { IMAGE_ACCEPT, MAX_IMAGE_BYTES } from "./content-spec";

const MAX_SIDE = 1600;
const KEEP_AS_IS_BYTES = 600 * 1024;

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** The picture scaled down to MAX_SIDE and re-encoded as WebP (JPEG where the browser cannot), or the original when that is not smaller. */
export async function prepareImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await encode(canvas, "image/webp", 0.86);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.88);
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export type UploadResult = { id: string } | { error: string };

export async function uploadImage(file: File): Promise<UploadResult> {
  if (!(IMAGE_ACCEPT as readonly string[]).includes(file.type)) return { error: "نوع الملف غير مدعوم (JPG أو PNG أو WebP بس)" };
  const blob = await prepareImage(file);
  if (blob.size > MAX_IMAGE_BYTES) return { error: "الصورة كبيرة (أكتر من 2 ميجا) حتى بعد التصغير. جرّب صورة أصغر." };

  const body = new FormData();
  body.append("file", blob, file.name);
  try {
    const response = await fetch("/admin/content/upload", { method: "POST", body, credentials: "same-origin" });
    if (!response.headers.get("content-type")?.includes("application/json")) return { error: "الجلسة انتهت. سجّل دخول تاني وجرّب." };
    const data = (await response.json()) as { id?: string; error?: string };
    if (response.ok && data.id) return { id: data.id };
    return { error: data.error ?? "تعذّر رفع الصورة" };
  } catch {
    return { error: "تعذّر الاتصال. اتأكد من النت وجرّب تاني." };
  }
}
