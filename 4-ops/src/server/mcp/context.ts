import "server-only";
import type { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import type { TokenUser } from "../api-tokens";
import { runAs } from "../actor";
import { can, type Permission } from "../permissions";

// What every MCP tool is built from. Reads call the server modules directly, behind the same permission checks the
// pages make. Writes call the very server actions the pages submit to (src/app/actions/*), run as the key's owner,
// so validation, permissions and side effects (activity log, deal stages...) can never differ from the app.

/** A refusal or a validation message, shown to the client as the tool's error. */
export class ToolError extends Error {}

export type ToolDef<S extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Changes data: logged for the owner to review, and announced to clients as not read-only. */
  write?: boolean;
  /** Cannot be undone from the app (voiding an invoice, cancelling a contract...). */
  destructive?: boolean;
  run: (args: z.output<S>, user: TokenUser) => Promise<unknown>;
};

export const tool = <S extends z.ZodType>(def: ToolDef<S>): ToolDef => def as unknown as ToolDef;

/** The same answer the app gives a person without the permission. */
export function need(user: TokenUser, permission: Permission): void {
  if (!can(user.role, permission)) throw new ToolError(`غير مسموح لدورك (${user.role}) بهذه العملية (${permission}).`);
}

export function found<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new ToolError(`${what} غير موجود، أو ليس لديك صلاحية الوصول إليه.`);
  return value;
}

type ActionFn = (previous: ActionState, formData: FormData) => Promise<ActionState | void>;
type PlainAction = (formData: FormData) => Promise<void>;

/** Where a server action's redirect() pointed, if the error is one. */
function redirectTarget(error: unknown): string | null {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  return digest.split(";")[2] ?? null;
}

export type ActResult = { ok: true; message?: string; location?: string };

/**
 * Submits `fields` to a server action as `user`, exactly as the form in the app would. The action's answer becomes the
 * tool's: an error (or field errors) is thrown as a ToolError; a redirect to the home page or the login page is a
 * refusal; any other redirect is a success that names where the new record lives ("/crm/deals/<id>").
 */
export async function act(user: TokenUser, action: ActionFn | PlainAction, fields: Record<string, string | number | boolean | null | undefined | string[]>): Promise<ActResult> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
    else formData.set(key, typeof value === "boolean" ? (value ? "on" : "") : String(value));
  }
  let state: ActionState | void;
  try {
    state = await runAs(user, () => (action.length >= 2 ? (action as ActionFn)(null, formData) : (action as PlainAction)(formData)));
  } catch (error) {
    const to = redirectTarget(error);
    if (to === null) throw error;
    if (to === "/" || to.startsWith("/login") || to.startsWith("/account/password")) throw new ToolError("غير مسموح لدورك بهذه العملية، أو العنصر غير موجود.");
    return { ok: true, location: to };
  }
  if (state?.error) throw new ToolError(state.error);
  if (state?.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
    throw new ToolError(Object.entries(state.fieldErrors).map(([field, message]) => `${field}: ${message}`).join("؛ "));
  }
  return { ok: true, message: state?.message };
}

/** "/crm/deals/<id>" -> "<id>" (the last path segment), for tools that report the id of what they created. */
export const idFrom = (location: string | undefined): string | null => location?.split(/[/?#]/).filter(Boolean).pop() ?? null;
