import { handle, json } from "@/server/http";
import { getHealth } from "@/server/services/health";

export const GET = handle(async () => json(await getHealth()));
