import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// REAL agent runs through the Dashboard's own services (same prompts, permissions and parsers it uses in
// production), against a throw-away copy of the Marketing Agent project. scripts/smoke-agents.mjs prepares the
// environment (AGENT_ROOT, DATA_DIR, RUN_BUDGET_USD) and refuses to start unless something is signed in (an API key,
// or the claude.ai login `claude` already has; the latter counts against your plan's usage limits).
//
// What this proves: the agents load, obey the output templates the parsers expect, stay inside their write
// permissions, and the Dashboard's cards move through every stage. What it cannot prove: that the clusters or
// scripts are *good*; read the files it prints at the end.

const agentRoot = process.env.AGENT_ROOT!;
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const COMMENTS = [
  ["كام سعر عمل موقع إلكتروني؟", 41],
  ["بكام تصميم موقع لشركة؟", 17],
  ["السعر كام لو عايز موقع بسيط؟", 9],
  ["بتعملوا تطبيقات موبايل؟", 22],
  ["تطبيق Flutter بيتكلف كام؟", 8],
  ["ينفع متجر إلكتروني على شوبيفاي؟", 12],
  ["ازاي ابدأ معاكم وأتواصل؟", 5],
  ["هل في دعم بعد التسليم؟", 14],
  ["بيخلص في قد إيه؟", 6],
  ["ما شاء الله ربنا يوفقكم", 30],
  ["الموقع بيظهر في جوجل؟ يعني SEO؟", 11],
  ["عايز أعمل نظام حجوزات لعيادتي", 7],
]
  .map(([text, likes]) => `${text} | ${likes}`)
  .join("\n");

type Mods = {
  db: typeof import("@/server/db");
  research: typeof import("@/server/services/research");
  cards: typeof import("@/server/services/cards");
  script: typeof import("@/server/services/script");
  filming: typeof import("@/server/services/filming");
  posting: typeof import("@/server/services/posting");
  paths: typeof import("@/server/paths");
};
const m = {} as Mods;
const touched: string[] = [];

function sha(file: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
const styleHashes = () => Object.fromEntries(["script-style.md", "montage-style.md"].map((f) => [f, sha(path.join(agentRoot, "marketing/style", f))]));
let styleBefore: Record<string, string>;

async function done(runId: string) {
  for (;;) {
    const run = m.db.getRun(runId)!;
    if (["succeeded", "failed", "cancelled"].includes(run.status)) {
      const steps = (run.steps ?? []).map((s: { label: string }) => `   · ${s.label}`).join("\n");
      console.log(`\n[${run.kind}] ${run.status}${run.costUsd != null ? `  $${run.costUsd.toFixed(3)}` : ""}${run.error ? `\n   error: ${run.error}` : ""}\n${steps}`);
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

beforeAll(async () => {
  expect(process.env.FAKE_AGENT_RUNS ?? "").not.toBe("1");
  vi.resetModules();
  // The same sign-in check the Dashboard uses: an API key or the claude.ai login. Prints only the kind and plan.
  const { getAuth } = await import("@/server/agents/auth");
  const { env } = await import("@/server/env");
  const auth = await getAuth();
  console.log(`\nSign-in: ${auth.method}${auth.plan ? ` (${auth.plan})` : ""}, mode ${env.authMode}`);
  expect(auth.method, "not signed in: run `claude` and /login, or set ANTHROPIC_API_KEY").not.toBe("none");
  m.db = await import("@/server/db");
  m.research = await import("@/server/services/research");
  m.cards = await import("@/server/services/cards");
  m.script = await import("@/server/services/script");
  m.filming = await import("@/server/services/filming");
  m.posting = await import("@/server/services/posting");
  m.paths = await import("@/server/paths");
  styleBefore = styleHashes();
});

afterAll(() => {
  console.log("\nFiles to read by eye (this is where quality shows up):");
  for (const file of touched) console.log("  " + path.join(agentRoot, file));
});

let cardId = "";

describe("real agents, one video end to end", () => {
  it("research-agent clusters the comments and its totals add up", async () => {
    const saved = m.research.savePastedComments(COMMENTS);
    const run = await done(m.research.startResearch(saved.file).id);
    expect(run.error).toBeNull();
    expect(run.status).toBe("succeeded");
    touched.push(run.outputFile!);
    const view = m.research.getIdeasView(run.outputFile!);
    expect(view.parsed.summary.total).toBe(12); // the file the agent wrote must count what we sent
    expect(view.parsed.sumCheck.ok, "cluster counts must sum to the total").toBe(true);
    expect(view.parsed.ideas.length).toBeGreaterThan(0);
    const card = m.cards.createCardFromIdea({ ideasFile: run.outputFile!, ideaNo: view.parsed.ideas[0].no, slug: "smoke-test-idea" });
    cardId = card.id;
  });

  it("script-agent writes a script in the template and the user's gates hold", async () => {
    const run = await done(m.script.startScript(cardId).id);
    expect(run.status).toBe("succeeded");
    const view = m.script.getScriptView(cardId);
    touched.push(view.script!.file);
    expect(view.script!.parts.hook.length).toBeGreaterThan(5);
    expect(view.script!.parts.body.length).toBeGreaterThan(20);
    expect(view.script!.parts.cta.length).toBeGreaterThan(3);
    m.script.approveScript(cardId, true);
  });

  it("the shot list comes back as a table the Dashboard can parse", async () => {
    const run = await done(m.filming.startShotList(cardId).id);
    expect(run.status).toBe("succeeded");
    const view = await m.filming.getFilmingView(cardId);
    touched.push(view.shotlist!.file);
    expect(view.shotlist!.rows.length).toBeGreaterThan(1);
  });

  it.skipIf(!hasFfmpeg)("montage-agent plans cuts for a real file, using real frames", async () => {
    const video = path.join(path.dirname(agentRoot), "smoke.mp4");
    const made = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=12",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
      "-shortest", "-pix_fmt", "yuv420p", video,
    ]);
    expect(made.status).toBe(0);
    await m.filming.uploadFootage(cardId, Readable.toWeb(fs.createReadStream(video)) as unknown as ReadableStream<Uint8Array>, "smoke.mp4", fs.statSync(video).size);
    const run = await done(m.filming.startMontage(cardId).id);
    expect(run.status).toBe("succeeded");
    const view = await m.filming.getFilmingView(cardId);
    touched.push(view.montage!.file);
    expect(view.montage!.parsed.timeline.length).toBeGreaterThan(0);
    m.filming.approveMontage(cardId);
  });

  it.skipIf(!hasFfmpeg)("posting-agent writes caption, hashtags and a time, and nothing gets published", async () => {
    const run = await done(m.posting.startPosting(cardId, null).id);
    expect(run.status).toBe("succeeded");
    const view = m.posting.getPostingView(cardId);
    touched.push(view.post!.file);
    expect(view.post!.parts.caption.length).toBeGreaterThan(5);
    const ready = m.posting.markReady(cardId);
    expect(ready.stage).toBe("ready"); // marks the card only; there is no publishing code at all
  });

  it("no run touched the user's own training or input files", () => {
    expect(styleHashes()).toEqual(styleBefore);
    // keywords.md / services.md are written only by the Dashboard's own Research form, never by an agent run
    const inputs = fs.readdirSync(path.join(agentRoot, "marketing/inputs")).sort();
    expect(inputs.filter((f) => !/^comments-\d{4}-\d{2}-\d{2}(-\d+)?\.txt$/.test(f))).toEqual(["README.md", "keywords.md", "services.md"].sort());
  });
});
