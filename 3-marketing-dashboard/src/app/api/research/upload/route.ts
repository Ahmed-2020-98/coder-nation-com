import { handle, json } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { previewUpload } from "@/server/services/research";

const MAX_BYTES = 25 * 1024 * 1024;

/** Step 1 of a spreadsheet upload: read the file and return its columns + a sample, so the user picks the right ones. */
export const POST = handle(async (request) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ServiceError(400, "ارفع ملف TXT أو CSV أو XLSX");
  if (file.size > MAX_BYTES) throw new ServiceError(413, "الملف أكبر من 25 MB");
  return json(await previewUpload(Buffer.from(await file.arrayBuffer()), file.name));
});
