import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Db } from "../src/server/sql";
import { clearTables, createTestDb, dropTestDb, type TestDb } from "./helpers/db";
import { ar } from "@/content/ar";
import { toFormState, toPayload } from "@/lib/content-form";
import {
  UUID_RE,
  computeView,
  defaultsFor,
  fieldErrors,
  isLinkHidden,
  normalizeStored,
  parseStoredSection,
  referencedMediaIds,
  sectionSchema,
  visibleLinks,
  type StoredContent,
} from "@/lib/content-model";
import { HIDEABLE_SECTIONS, NUMBERED_SECTIONS, SECTION_IDS, SECTION_SPECS, isSafeHref, type FieldSpec, type SectionId } from "@/lib/content-spec";

// The editable page text: what may be saved (validation built from the field specs), what the page shows (defaults with
// the saved text on top), and the database side (saving, resetting, hiding, uploaded images and their cleanup).

type Plain = Record<string, unknown>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const emptyStored = (): StoredContent => ({ sections: {}, hidden: [] });

describe("links the panel will accept", () => {
  it("allows on-page sections, site paths, https, mailto and tel", () => {
    for (const ok of ["#contact", "#why-us", "/privacy", "/a/b?x=1#y", "https://example.com", "https://sub.example.com/path?q=1", "mailto:hello@example.com", "tel:+201012345678"]) {
      expect(isSafeHref(ok), ok).toBe(true);
    }
  });

  it("refuses scripts, data URLs, protocol-relative and credential links, spaces and markup", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "//evil.example", "http://example.com/x?y", "https://user:pw@example.com", "https://localhost", "#", "# contact", "/ path", '#a"onclick="x', "https://exa mple.com", "ftp://example.com", "", "mailto:", "tel:abc"]) {
      expect(isSafeHref(bad), bad).toBe(false);
    }
    expect(isSafeHref("http://example.com")).toBe(false);
    expect(isSafeHref("x".repeat(201))).toBe(false);
  });

  it("with httpsOnly, only https URLs pass (a project link must not be a #section or a mailto)", () => {
    expect(isSafeHref("https://example.com", true)).toBe(true);
    for (const bad of ["#contact", "/privacy", "mailto:a@b.co", "tel:+201012345678"]) expect(isSafeHref(bad, true), bad).toBe(false);
  });
});

describe("the shipped text and the specs agree", () => {
  it("every section's default text is itself valid, so saving it unchanged always works", () => {
    for (const id of SECTION_IDS) {
      const result = sectionSchema(id).safeParse(defaultsFor(id));
      expect(result.success, `${id}: ${result.success ? "" : JSON.stringify(fieldErrors(result.error))}`).toBe(true);
    }
  });

  it("the form's state round-trips to exactly the defaults (no `_k` leaks, nothing lost)", () => {
    for (const id of SECTION_IDS) {
      const fields = SECTION_SPECS[id].fields;
      const state = toFormState(fields, defaultsFor(id));
      expect(toPayload(fields, state), id).toEqual(defaultsFor(id));
      expect(JSON.stringify(toPayload(fields, state))).not.toContain("_k");
    }
  });

  it("a freshly added item is valid as it is (the 'add' buttons never produce something unsavable)", () => {
    const walk = (fields: Record<string, FieldSpec>, value: Plain, path: string, check: (candidate: Plain) => void) => {
      for (const [key, spec] of Object.entries(fields)) {
        if (spec.kind !== "list") continue;
        const items = (value[key] as Plain[]) ?? [];
        const withBlank = clone(value);
        (withBlank[key] as Plain[]) = [...items, spec.blank()];
        if (items.length < spec.max) check(withBlank);
        // Lists nested inside an item (footer links): add a blank one to the first item.
        if (items[0]) walk(spec.fields, items[0], `${path}${key}.0.`, (inner) => {
          const next = clone(value);
          (next[key] as Plain[])[0] = inner;
          check(next);
        });
      }
    };
    let checked = 0;
    for (const id of SECTION_IDS) {
      walk(SECTION_SPECS[id].fields, defaultsFor(id), "", (candidate) => {
        const result = sectionSchema(id).safeParse(candidate);
        expect(result.success, `${id}: ${result.success ? "" : JSON.stringify(fieldErrors(result.error))}`).toBe(true);
        checked++;
      });
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it("only these sections can be switched off, and each one's anchor exists on the page", () => {
    expect([...HIDEABLE_SECTIONS]).toEqual(["services", "why", "process", "work", "testimonials", "faq"]);
    expect(NUMBERED_SECTIONS.at(-1)).toBe("contact");
  });
});

describe("what a section must look like to be saved", () => {
  const hero = () => clone(defaultsFor("hero"));
  const errorsOf = (id: SectionId, value: unknown) => {
    const result = sectionSchema(id).safeParse(value);
    return result.success ? null : fieldErrors(result.error);
  };

  it("accepts valid text, trims it, and drops keys that are not in the spec", () => {
    const value = { ...hero(), badge: "  نستقبل مشاريع  ", extra: "<script>" };
    const parsed = sectionSchema("hero").parse(value) as Plain;
    expect(parsed.badge).toBe("نستقبل مشاريع");
    expect(parsed).not.toHaveProperty("extra");
  });

  it("reports every problem at once, keyed by the field's path", () => {
    const value = hero() as Plain & { primaryCta: Plain; stack: string[] };
    value.titleLead = "";
    value.primaryCta = { label: "اطلب", href: "javascript:alert(1)" };
    value.stack = ["x".repeat(30)];
    expect(Object.keys(errorsOf("hero", value) ?? {}).sort()).toEqual(["primaryCta.href", "stack.0", "titleLead"]);
  });

  it("a required field cannot be blank, even with only spaces; an optional one can", () => {
    const value = clone(defaultsFor("work")) as Plain & { items: Plain[] };
    value.items[0].title = "   ";
    expect(errorsOf("work", value)).toHaveProperty("items.0.title");
    value.items[0].title = "مشروع حقيقي";
    value.items[0].link = "";
    expect(errorsOf("work", value)).toBeNull();
    value.items[0].link = "http://not-secure.example.com";
    expect(errorsOf("work", value)).toHaveProperty("items.0.link");
    value.items[0].link = "https://client.example.com";
    expect(errorsOf("work", value)).toBeNull();
  });

  it("an empty required field says it is required; a too-short one says how long it must be", () => {
    const work = clone(defaultsFor("work")) as Plain & { items: Plain[] };
    work.items[0].title = "";
    expect(errorsOf("work", work)).toMatchObject({ "items.0.title": "الحقل ده مطلوب" });
    work.items[0].title = "م";
    expect(errorsOf("work", work)).toMatchObject({ "items.0.title": "2 أحرف على الأقل" });
  });

  it("single-line fields refuse line breaks, text areas keep them", () => {
    const value = hero();
    value.badge = "سطر\nتاني";
    expect(errorsOf("hero", value)).toHaveProperty("badge");
    value.badge = "سطر واحد";
    value.description = "سطر أول\r\nسطر تاني طويل كفاية";
    const parsed = sectionSchema("hero").parse(value) as Plain;
    expect(parsed.description).toBe("سطر أول\nسطر تاني طويل كفاية");
  });

  it("limits the number of items, their length and the values of a choice", () => {
    const faq = clone(defaultsFor("faq")) as Plain & { items: Plain[] };
    faq.items = Array.from({ length: 21 }, () => ({ q: "سؤال؟", a: "إجابة" }));
    expect(errorsOf("faq", faq)).toHaveProperty("items");
    const services = clone(defaultsFor("services")) as Plain & { items: Plain[] };
    services.items[0].icon = "../../etc/passwd";
    expect(errorsOf("services", services)).toHaveProperty("items.0.icon");
    services.items = [];
    expect(errorsOf("services", services)).toHaveProperty("items");
  });

  it("an image must be an uploaded image's id (or empty), nothing else", () => {
    const work = clone(defaultsFor("work")) as Plain & { items: Plain[] };
    for (const bad of ["https://evil.example/x.png", "../../x", "javascript:1", "123"]) {
      work.items[0].image = bad;
      expect(errorsOf("work", work), bad).toHaveProperty("items.0.image");
    }
    work.items[0].image = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    expect(errorsOf("work", work)).toBeNull();
  });

  it("the hidden commit hash of a process step keeps its shape", () => {
    const process = clone(defaultsFor("process")) as Plain & { steps: Plain[] };
    process.steps[0].hash = "not-a-hash";
    expect(errorsOf("process", process)).toHaveProperty("steps.0.hash");
  });
});

describe("what the page shows", () => {
  const withSection = (id: SectionId, edit: (value: Plain) => void, base: StoredContent = emptyStored()): StoredContent => {
    const value = clone(defaultsFor(id));
    edit(value);
    return { ...base, sections: { ...base.sections, [id]: value } };
  };

  it("with nothing saved it is exactly the text that ships, every section numbered in order", () => {
    const view = computeView();
    expect(view.content).toEqual(ar);
    expect(view.hidden).toEqual([]);
    expect(view.indexes).toEqual({ services: "01", why: "02", process: "03", work: "04", testimonials: "05", faq: "06", contact: "07" });
  });

  it("a saved section replaces the text, everything else (and the fields outside the spec) stays as shipped", () => {
    const view = computeView(withSection("hero", (hero) => (hero.titleHighlight = "تنمّي مشروعك")));
    expect(view.content.hero.titleHighlight).toBe("تنمّي مشروعك");
    expect(view.content.hero.visual).toEqual(ar.hero.visual); // the decorative code window is not editable
    expect(view.content.services).toEqual(ar.services);
    expect(view.content.contact.form).toEqual(ar.contact.form); // the form's labels and errors are not editable either
  });

  it("a saved section that is no longer valid is ignored whole, never half-applied", () => {
    const stored = emptyStored();
    stored.sections.hero = { ...defaultsFor("hero"), titleHighlight: "", badge: "نص جديد" };
    expect(computeView(stored).content.hero).toEqual(ar.hero);
    stored.sections.faq = "not even an object";
    expect(computeView(stored).content.faq).toEqual(ar.faq);
    expect(parseStoredSection("hero", null)).toBeNull();
  });

  it("switching a section off removes it, renumbers the others, and takes the links to it out of menus and buttons", () => {
    const view = computeView({ sections: {}, hidden: ["work", "services"] });
    expect(view.hidden).toEqual(["services", "work"]);
    expect(view.indexes).toEqual({ why: "01", process: "02", testimonials: "03", faq: "04", contact: "05" });
    expect(isLinkHidden("#work", view.hidden)).toBe(true);
    expect(isLinkHidden("#contact", view.hidden)).toBe(false);
    expect(visibleLinks(view.content.nav.links, view.hidden).map((link) => link.href)).toEqual(["#why", "#process", "#faq"]);
  });

  it("a section left with nothing in it disappears by itself (delete the sample testimonials and the section is gone)", () => {
    const view = computeView(withSection("testimonials", (value) => (value.items = [])));
    expect(view.hidden).toEqual(["testimonials"]);
    expect(view.indexes.faq).toBe("05");
  });

  it("switches that name a section that cannot be hidden are ignored", () => {
    expect(computeView({ sections: {}, hidden: ["contact", "hero", "nonsense"] }).hidden).toEqual([]);
  });

  it("garbage in the database never breaks the page", () => {
    for (const raw of [null, undefined, 5, "x", [], { sections: 5, hidden: "x" }, { sections: { hero: [] }, hidden: [1, null] }]) {
      expect(computeView(normalizeStored(raw)).content).toEqual(ar);
    }
  });

  it("finds every uploaded image the saved text points at", () => {
    const a = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const b = "11111111-2222-4333-8444-555555555555";
    const stored = withSection("work", (work) => {
      const items = work.items as Plain[];
      items[0].image = a;
      items[2].image = b.toUpperCase();
    });
    expect([...referencedMediaIds(stored)].sort()).toEqual([a, b].sort());
    expect(UUID_RE.test(a)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Database side. A throw-away database, created here and dropped at the end; no other database is touched.


type Mods = {
  db: typeof import("@/server/db");
  content: typeof import("@/server/content");
  media: typeof import("@/server/media");
};
const m = {} as Mods;
let raw: Db;
let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb("cn_site_test");
  raw = testDb.raw;
  process.env.DATABASE_URL = testDb.url;
  vi.resetModules();
  m.db = await import("@/server/db");
  m.content = await import("@/server/content");
  m.media = await import("@/server/media");
});

afterAll(async () => {
  await m.db?.closeDatabase();
  await dropTestDb(testDb);
});

beforeEach(async () => {
  await clearTables(raw, ["media", "settings"]);
});

const png = (extra = 0) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(24 + extra).fill(7)]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(30).fill(1)]);
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, ...new Array(20).fill(2)]);

describe("saving the page text", () => {
  it("stores a valid section, and the page view then shows it", async () => {
    const hero = clone(defaultsFor("hero"));
    hero.badge = "نستقبل مشاريع جديدة هذا الشهر";
    expect(await m.content.saveSection("hero", hero)).toEqual({ ok: true });
    const stored = await m.content.readStored();
    expect(computeView(stored).content.hero.badge).toBe("نستقبل مشاريع جديدة هذا الشهر");
    expect(m.content.currentSection("hero", stored)).toMatchObject({ modified: true, value: { badge: "نستقبل مشاريع جديدة هذا الشهر" } });
    expect(m.content.currentSection("faq", stored).modified).toBe(false);
  });

  it("refuses an invalid section with the field errors and stores nothing", async () => {
    const hero = clone(defaultsFor("hero"));
    hero.titleLead = "";
    const result = await m.content.saveSection("hero", hero);
    expect(result).toMatchObject({ ok: false, fieldErrors: { titleLead: expect.any(String) } });
    expect(await raw`select 1 from settings`).toHaveLength(0);
  });

  it("saving exactly the shipped text is the same as having no override", async () => {
    const hero = clone(defaultsFor("hero"));
    hero.badge = "تعديل";
    await m.content.saveSection("hero", hero);
    expect((await m.content.readStored()).sections).toHaveProperty("hero");
    await m.content.saveSection("hero", defaultsFor("hero"));
    expect((await m.content.readStored()).sections).not.toHaveProperty("hero");
  });

  it("reset goes back to the shipped text and leaves the other sections alone", async () => {
    const hero = clone(defaultsFor("hero"));
    hero.badge = "تعديل";
    const faq = clone(defaultsFor("faq")) as Plain & { items: Plain[] };
    faq.items = faq.items.slice(0, 2);
    await m.content.saveSection("hero", hero);
    await m.content.saveSection("faq", faq);
    await m.content.resetSection("hero");
    const stored = await m.content.readStored();
    expect(Object.keys(stored.sections)).toEqual(["faq"]);
    expect(computeView(stored).content.hero).toEqual(ar.hero);
    expect(computeView(stored).content.faq.items).toHaveLength(2);
  });

  it("switching a section off and on again; the hero cannot be switched off", async () => {
    expect(await m.content.setSectionHidden("work", true)).toEqual({ ok: true });
    expect((await m.content.readStored()).hidden).toEqual(["work"]);
    expect(await m.content.setSectionHidden("work", true)).toEqual({ ok: true }); // twice is still once
    expect((await m.content.readStored()).hidden).toEqual(["work"]);
    expect(await m.content.setSectionHidden("work", false)).toEqual({ ok: true });
    expect((await m.content.readStored()).hidden).toEqual([]);
    expect(await m.content.setSectionHidden("hero" as SectionId, true)).toMatchObject({ ok: false });
    expect((await m.content.readStored()).hidden).toEqual([]);
  });

  it("two admins saving different sections at the same moment both keep their work", async () => {
    const hero = clone(defaultsFor("hero"));
    hero.badge = "من أحمد";
    const faq = clone(defaultsFor("faq")) as Plain & { items: Plain[] };
    faq.items = faq.items.slice(0, 3);
    const contact = clone(defaultsFor("contact"));
    contact.codeComment = "من مها";
    await Promise.all([m.content.saveSection("hero", hero), m.content.saveSection("faq", faq), m.content.saveSection("contact", contact), m.content.setSectionHidden("work", true)]);
    const stored = await m.content.readStored();
    expect(Object.keys(stored.sections).sort()).toEqual(["contact", "faq", "hero"]);
    expect(stored.hidden).toEqual(["work"]);
  });

  it("the page text survives when the table holds something odd: the view falls back to the shipped text", async () => {
    await raw`insert into settings (name, value) values ('content', ${raw.json("just a string")})`;
    expect(computeView(await m.content.readStored()).content).toEqual(ar);
  });
});

describe("uploaded images", () => {
  it("stores a real PNG, JPEG and WebP and serves back the same bytes and type", async () => {
    for (const [bytes, mime] of [[png(), "image/png"], [jpeg(), "image/jpeg"], [webp(), "image/webp"]] as const) {
      const result = await m.media.storeImage(bytes);
      expect(result.ok).toBe(true);
      const image = await m.media.getImage((result as { id: string }).id);
      expect(image?.mime).toBe(mime);
      expect(new Uint8Array(image!.data)).toEqual(bytes);
    }
  });

  it("decides by the file's first bytes: SVG, HTML, scripts, GIF and renamed files are refused", async () => {
    const text = (value: string) => new TextEncoder().encode(value);
    for (const bad of [text("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), text("<html><script>alert(1)</script>"), text("GIF89a......"), text("MZ\u0090\u0000 not an image"), new Uint8Array(0), new Uint8Array([0xff, 0xd8])]) {
      expect(await m.media.storeImage(bad)).toMatchObject({ ok: false });
    }
    expect(await raw`select 1 from media`).toHaveLength(0);
  });

  it("refuses a file over 2 MB", async () => {
    const big = png(2 * 1024 * 1024);
    expect(await m.media.storeImage(big)).toMatchObject({ ok: false, error: expect.stringContaining("2") });
    expect(await raw`select 1 from media`).toHaveLength(0);
  });

  it("the table itself refuses a type that is not a raster image", async () => {
    await expect(raw`insert into media (id, mime, data, size_bytes) values (${randomUUID()}, 'image/svg+xml', ${Buffer.from("x")}, 1)`).rejects.toThrow();
    await expect(raw`insert into media (id, mime, data, size_bytes) values (${randomUUID()}, 'image/png', ${Buffer.from("xx")}, 1)`).rejects.toThrow();
  });

  it("getImage only answers for a well-formed id that exists", async () => {
    expect(await m.media.getImage("not-a-uuid")).toBeNull();
    expect(await m.media.getImage("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBeNull();
    expect(await m.media.getImage("1; drop table media")).toBeNull();
  });

  it("cleanup removes only old images that nothing refers to", async () => {
    const used = (await m.media.storeImage(png())) as { id: string };
    const orphan = (await m.media.storeImage(png(1))) as { id: string };
    const fresh = (await m.media.storeImage(png(2))) as { id: string };
    await raw`update media set created_at = now(3) - interval 3 hour where id in (${used.id}, ${orphan.id})`;
    expect(await m.media.purgeOrphanMedia(new Set([used.id]))).toBe(1);
    const left = (await raw`select id from media`).map((row) => row.id).sort();
    expect(left).toEqual([used.id, fresh.id].sort()); // `fresh` may still belong to an unsaved form
  });

  it("saving a project keeps its image; replacing the image and saving removes the old file once it is old enough", async () => {
    const store = async (bytes: Uint8Array) => ((await m.media.storeImage(bytes)) as { id: string }).id;
    const ids = async () => (await raw`select id from media`).map((row) => row.id as string).sort();
    const first = await store(png());
    const stray = await store(png(1)); // uploaded, never used
    await raw`update media set created_at = now(3) - interval 3 hour`;

    const work = clone(defaultsFor("work")) as Plain & { items: Plain[] };
    work.items[0].image = first;
    expect(await m.content.saveSection("work", work)).toEqual({ ok: true });
    expect(await ids()).toEqual([first]); // the stray one is gone, the used one stays

    const second = await store(png(2));
    work.items[0].image = second;
    await m.content.saveSection("work", work);
    expect(await ids()).toEqual([second]); // `first` was replaced and old: gone; `second` is in use

    await m.content.resetSection("work");
    expect(await ids()).toEqual([second]); // unused now, but younger than the grace period: it may belong to an open form
    await raw`update media set created_at = now(3) - interval 3 hour`;
    await m.content.resetSection("work");
    expect(await ids()).toEqual([]);
    expect(stray).not.toBe(first);
  });
});
