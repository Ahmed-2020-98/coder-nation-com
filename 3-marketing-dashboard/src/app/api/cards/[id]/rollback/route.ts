import { handle, json } from "@/server/http";
import { rollbackCard } from "@/server/services/cards";

export const POST = handle<RouteContext<"/api/cards/[id]/rollback">>(async (_request, context) => {
  const { id } = await context.params;
  return json({ card: rollbackCard(id) });
});
