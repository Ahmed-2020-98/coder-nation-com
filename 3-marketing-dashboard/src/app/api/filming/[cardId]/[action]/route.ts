import { handle, json } from "@/server/http";
import { ServiceError } from "@/server/services/common";
import { approveMontage, startMontage, startShotList } from "@/server/services/filming";

export const POST = handle<RouteContext<"/api/filming/[cardId]/[action]">>(async (_request, context) => {
  const { cardId, action } = await context.params;
  switch (action) {
    case "shotlist":
      return json({ run: startShotList(cardId) }, { status: 202 });
    case "montage":
      return json({ run: startMontage(cardId) }, { status: 202 });
    case "approve-montage":
      return json({ card: approveMontage(cardId) });
    default:
      throw new ServiceError(404, "إجراء غير معروف");
  }
});
