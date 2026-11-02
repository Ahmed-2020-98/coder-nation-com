import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "./auth-core";

// Who is acting when the request carries no session cookie: the MCP endpoint runs the very same server actions the
// pages use, as the owner of the API key. Everything that asks "who is signed in" (src/server/session.ts) sees this
// person for the duration of `runAs`, and nothing else ever does.
const store = new AsyncLocalStorage<SessionUser>();

export const runAs = <T>(user: SessionUser, fn: () => Promise<T>): Promise<T> => store.run(user, fn);

/** The person an MCP call acts as, or undefined in a normal page request. */
export const currentActor = (): SessionUser | undefined => store.getStore();
