"use server";

import { formText, type ActionState } from "@/lib/action-state";
import { createToken, revokeToken } from "@/server/api-tokens";
import { refresh } from "@/server/refresh";
import { requirePermission } from "@/server/session";

/** A new MCP key for the owner. The key is returned ONCE, to this form only; the database keeps its hash. */
export async function createTokenAction(_previous: ActionState, formData: FormData): Promise<ActionState & { token?: string }> {
  const user = await requirePermission("mcp.manage");
  const result = await createToken(user.id, formText(formData, "name"), Number(formText(formData, "days")));
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true, token: result.token, message: "اتعمل المفتاح. انسخه دلوقتي: مش هيظهر تاني." };
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  await requirePermission("mcp.manage");
  const id = formText(formData, "id");
  if (/^[0-9a-f-]{36}$/i.test(id)) await revokeToken(id);
  refresh();
}
