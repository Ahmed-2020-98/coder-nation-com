import { handle, json } from "@/server/http";
import { getFilmingView } from "@/server/services/filming";

export const GET = handle<RouteContext<"/api/filming/[cardId]">>(async (_request, context) => {
  const { cardId } = await context.params;
  return json(await getFilmingView(cardId));
});
