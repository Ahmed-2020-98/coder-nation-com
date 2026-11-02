import "server-only";
import { refresh as nextRefresh } from "next/cache";
import { currentActor } from "./actor";

/**
 * next/cache's refresh(), which re-renders the page the action was submitted from. An action run by the MCP endpoint
 * has no page to refresh (and Next forbids refresh() outside a Server Action), so there it does nothing.
 */
export function refresh(): void {
  if (currentActor()) return;
  nextRefresh();
}
