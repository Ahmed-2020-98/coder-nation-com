import { handle, json } from "@/server/http";
import { getCalendar } from "@/server/services/posting";

export const GET = handle(async () => json(getCalendar()));
