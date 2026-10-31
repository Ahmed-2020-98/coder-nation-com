import { UUID_RE } from "@/lib/content-model";
import { getImage } from "@/server/media";

const gone = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * An image uploaded from the admin panel, straight from the database. The URL carries the image's own random id and a
 * replaced image gets a new one, so it can be cached for good by browsers and the host's CDN. The file is only ever
 * served as the raster type it was verified to be, and the headers stop a browser from treating it as anything else.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return gone();

  let image;
  try {
    image = await getImage(id);
  } catch (error) {
    console.error("[media]", error instanceof Error ? error.message : error);
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
  if (!image) return gone();

  const headers = {
    "Content-Type": image.mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${id.toLowerCase()}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(image.data), { headers: { ...headers, "Content-Length": String(image.data.length) } });
}
