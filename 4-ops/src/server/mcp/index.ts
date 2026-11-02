import "server-only";
import { createMcpHandler } from "mcp-handler";
import { logCall, type TokenUser } from "../api-tokens";
import { ToolError, type ToolDef } from "./context";
import { agreementTools } from "./agreements";
import { crmTools } from "./crm";
import { deliveryTools } from "./delivery";
import { peopleTools } from "./people";

// Every tool the Ops MCP server offers. Each module's tools live in their own file next to this one.
export const TOOLS: ToolDef[] = [...peopleTools, ...crmTools, ...deliveryTools, ...agreementTools];

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

/** Runs one tool for `user`: errors become tool errors (never a crash), writes and refusals go to the review log. */
export async function runTool(def: ToolDef, args: unknown, user: TokenUser) {
  try {
    const result = await def.run(args, user);
    if (def.write) await logCall(user.tokenId, def.name, true);
    return json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof ToolError) {
      await logCall(user.tokenId, def.name, false, error.message);
      return failure(error.message);
    }
    console.error("[mcp]", def.name, error instanceof Error ? error.message : error);
    await logCall(user.tokenId, def.name, false, "internal error");
    return failure("حدث خطأ داخلي في النظام. لم يكتمل الطلب.");
  }
}

/** The MCP request handler. The caller (the route) has already turned the API key into `request.auth.extra.user`. */
export const mcpHandler = createMcpHandler(
  (server) => {
    // The tools are registered from a list, so their schemas' types are erased here; each tool's `run` gets its
    // arguments already parsed by its own zod schema.
    const register = server.registerTool.bind(server) as (name: string, config: object, cb: (args: unknown, ctx: Ctx) => Promise<unknown>) => unknown;
    for (const def of TOOLS) {
      register(
        def.name,
        {
          title: def.title,
          description: def.description,
          inputSchema: def.input,
          annotations: { readOnlyHint: !def.write, destructiveHint: Boolean(def.destructive), openWorldHint: false },
        },
        async (args, ctx) => {
          const user = ctx.http?.authInfo?.extra?.user as TokenUser | undefined;
          if (!user) return failure("غير مصرّح.");
          return runTool(def, args, user);
        },
      );
    }
  },
  {
    serverInfo: { name: "coder-nation-ops", version: "1.0.0" },
    instructions:
      "Coder Nation Ops: the company's CRM (clients, deals, proposals, projects, tasks, attendance, contracts, invoices). " +
      "You act as the API key's owner with exactly their permissions. Money amounts in inputs are plain decimal text in the " +
      "deal/proposal currency (\"15000\" or \"1500.50\"). Look records up (list_* / get_*) before changing them. Text is Arabic.",
  },
);
