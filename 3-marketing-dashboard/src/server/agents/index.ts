import "server-only";
import { env } from "../env";
import { runFake } from "./fake";
import { runWithSdk } from "./sdk";
import type { Runner } from "./types";

/** The real SDK runner, or the dev-only simulator when FAKE_AGENT_RUNS=1 (never in production). */
export const runAgent: Runner = (job, signal) => (env.fakeAgents ? runFake(job, signal) : runWithSdk(job, signal));
