import { userFromApiToken } from "@/server/api-tokens";
import { mcpHandler } from "@/server/mcp";
import { hit } from "@/server/rate-limit";

// The MCP endpoint (Streamable HTTP, stateless). Open in src/proxy.ts because it authenticates every request itself:
// "Authorization: Bearer cno_..." with a key made in Ops -> مفاتيح الـ MCP. The key's owner is who acts.
export const maxDuration = 60;

const MAX_BODY_BYTES = 256 * 1024;
const reply = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function handle(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return reply(413, "too large");
  const [scheme, key] = (request.headers.get("authorization") ?? "").split(" ");
  // One answer for every kind of failure: the caller learns nothing about why.
  const user = scheme?.toLowerCase() === "bearer" ? await userFromApiToken(key).catch(() => null) : null;
  if (!user) return reply(401, "unauthorized");
  if (!(await hit(`mcp:${user.tokenId}`, 120, 60)).allowed) return reply(429, "slow down");
  request.auth = { token: user.tokenId, clientId: user.tokenId, scopes: [], extra: { user } };
  return mcpHandler(request);
}

export { handle as GET, handle as POST, handle as DELETE };
