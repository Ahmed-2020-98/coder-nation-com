import { describe, expect, it, vi } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { formatDateTime, whatsappLinkFor } from "@/lib/lead-contact";
import { EMAIL_RE, PHONE_RE, normalizePhone } from "@/lib/lead-rules";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/server/password";
import { parseLeadInput } from "@/server/leads";
import { DEFAULT_SETTINGS, mergeSettings, settingsSchema } from "@/server/settings";

describe("phone and email rules", () => {
  it("normalizes Arabic/Persian digits, spaces, dashes and brackets", () => {
    expect(normalizePhone("+٢٠ ١٠٠ ٠٠٠-٠٠٠٠")).toBe("+2010000000" + "00");
    expect(normalizePhone("(۰۱۰) 123.4567")).toBe("0101234567");
    expect(normalizePhone("  +20 100 000 0000 ")).toBe("+201000000000");
  });
  it("accepts 8-15 digits with an optional +, nothing else", () => {
    for (const ok of ["0100000000", "+201000000000", "12345678", "123456789012345"]) expect(PHONE_RE.test(ok), ok).toBe(true);
    for (const bad of ["1234567", "1234567890123456", "01a0000000", "++20100000000", "", "0100 000000"]) expect(PHONE_RE.test(bad), bad).toBe(false);
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
    expect(EMAIL_RE.test("a@b")).toBe(false);
    expect(EMAIL_RE.test("a b@c.com")).toBe(false);
  });
});

describe("parseLeadInput (the server-side check on the public form)", () => {
  const good = { name: " أحمد ", phone: "+٢٠ ١٠٠ ٠٠٠ ٠٠٠٠", email: "", service: "موقع إلكتروني", message: "  أبغى موقع  " };
  it("normalizes a good request: trimmed text, ASCII phone, empty optionals become null", () => {
    const parsed = parseLeadInput(good);
    expect(parsed).toEqual({ ok: true, data: { name: "أحمد", phone: "+2010000000" + "00", email: null, service: "موقع إلكتروني", message: "أبغى موقع" } });
  });
  it("rejects short names, bad phones, bad emails, unknown services and oversized messages, each on its own field", () => {
    const parsed = parseLeadInput({ name: "ا", phone: "12", email: "nope", service: "ذرة", message: "x".repeat(2001) });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(Object.keys(parsed.fieldErrors).sort()).toEqual(["email", "message", "name", "phone", "service"]);
  });
  it("treats non-string values (a hand-made request) as empty rather than throwing", () => {
    const parsed = parseLeadInput({ name: { $gt: "" }, phone: ["+201000000000"] });
    expect(parsed.ok).toBe(false);
  });
  it("accepts every service the form offers and nothing outside that list", async () => {
    const { content } = await import("@/content");
    for (const service of content.contact.form.fields.service.options) expect(parseLeadInput({ ...good, service }).ok, service).toBe(true);
    expect(parseLeadInput({ ...good, service: "'; drop table leads; --" }).ok).toBe(false);
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
  });
  it("treats unicode-equivalent passwords as the same (NFKC)", async () => {
    const hash = await hashPassword("café-password-1");
    expect(await verifyPassword("café-password-1", hash)).toBe(true);
  });
  it("refuses malformed or hostile stored hashes without throwing or allocating a lot", async () => {
    for (const stored of ["", "plain", "scrypt$1$1$1$a$b", "scrypt$999999999$8$1$YQ$YQ", "scrypt$32768$8$1$YQ", "bcrypt$x$y$z$a$b", "scrypt$32768$8$1$$"]) {
      expect(await verifyPassword("x", stored), stored).toBe(false);
    }
  });
  it("has a dummy hash to verify against when the email is unknown, and a sane policy", async () => {
    expect(await verifyPassword("anything", await dummyHash())).toBe(false);
    expect(passwordProblem("short")).toMatch(/12/);
    expect(passwordProblem("aaaaaaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("x".repeat(201))).toBeTruthy();
    expect(passwordProblem("a perfectly fine passphrase")).toBeNull();
  });
});

describe("csv", () => {
  it("neutralizes spreadsheet formulas and quotes what needs quoting", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    for (const lead of ["+1", "-1", "@SUM(A1)", "\t=1", "\r=1"]) expect(csvCell(lead).includes(`'${lead.replace(/\r/g, "")}`) || csvCell(lead).startsWith(`"'`) || csvCell(lead).startsWith("'"), lead).toBe(true);
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(42)).toBe("42");
    expect(csvCell("عادي")).toBe("عادي");
  });
  it("starts with a BOM (Excel + Arabic) and uses CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n");
  });
});

describe("lead contact helpers", () => {
  it("builds a wa.me link only when the number is international", () => {
    expect(whatsappLinkFor("+201000000000")).toBe("https://wa.me/201000000000");
    expect(whatsappLinkFor("00201000000000")).toBe("https://wa.me/201000000000");
    expect(whatsappLinkFor("01000000000")).toBeNull();
  });
  it("formats dates in Arabic, Cairo time", () => {
    expect(formatDateTime(new Date("2026-01-01T10:00:00Z"))).toMatch(/[٠-٩]/);
  });
});

describe("site settings", () => {
  const valid = {
    whatsappNumber: "+20 100 123 4567",
    email: "hello@coder-nation.com",
    workingHours: "الأحد – الخميس",
    socials: { linkedin: "https://linkedin.com/company/x", x: "", instagram: "", github: "", tiktok: "", youtube: "" },
    seo: { title: "Coder Nation | مواقع وتطبيقات", description: "نصمّم ونبرمج مواقع وتطبيقات موبايل بجودة عالية وأداء ممتاز." },
    ecosystem: { marketing: false, sales: false, crm: true },
  };
  it("accepts good settings and normalizes the WhatsApp number to digits", () => {
    const parsed = settingsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.whatsappNumber).toBe("201001234567");
  });
  it("rejects javascript:/http/data URLs and credentials in social links, bad numbers, short seo", () => {
    for (const url of ["javascript:alert(1)", "http://x.com/a", "data:text/html,hi", "https://user:pw@x.com", "https://nodot", "ftp://x.com"]) {
      expect(settingsSchema.safeParse({ ...valid, socials: { ...valid.socials, x: url } }).success, url).toBe(false);
    }
    expect(settingsSchema.safeParse({ ...valid, whatsappNumber: "123" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, whatsappNumber: "+20abc" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, seo: { title: "x", description: "y" } }).success).toBe(false);
  });
  it("merges stored data over the defaults field by field, and survives garbage", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("junk")).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ whatsappNumber: "201111111111" }).whatsappNumber).toBe("201111111111");
    expect(mergeSettings({ whatsappNumber: "201111111111" }).email).toBe(DEFAULT_SETTINGS.email);
    // one bad field voids the stored object rather than half-applying it: the defaults win
    expect(mergeSettings({ whatsappNumber: "nope", email: "x@y.zz" })).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ socials: { linkedin: "https://linkedin.com/in/me" } }).socials.github).toBe("");
  });
  it("defaults come from the code: the placeholder WhatsApp, the ar.ts contact rows, all ecosystem links off", () => {
    expect(DEFAULT_SETTINGS.whatsappNumber).toBe("201000000000");
    expect(DEFAULT_SETTINGS.email).toBe("hello@coder-nation.com");
    expect(Object.values(DEFAULT_SETTINGS.ecosystem).every((on) => on === false)).toBe(true);
  });
});

describe("forwarding leads to the internal CRM", () => {
  const lead = { id: "11111111-2222-3333-4444-555555555555", name: "منى", phone: "+201000000002", email: null, service: null, message: null };
  const secret = "s".repeat(40);

  it("does nothing unless both variables are set, and never throws", async () => {
    const { forwardLeadToOps } = await import("@/server/ops-forward");
    delete process.env.OPS_INTAKE_URL;
    delete process.env.OPS_INTAKE_SECRET;
    const fetcher = vi.fn();
    expect(await forwardLeadToOps(lead, fetcher as unknown as typeof fetch)).toBe("skipped");
    process.env.OPS_INTAKE_URL = "http://127.0.0.1:3020/api/intake/website";
    process.env.OPS_INTAKE_SECRET = "too-short";
    expect(await forwardLeadToOps(lead, fetcher as unknown as typeof fetch)).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("signs the exact body it sends, with a fresh timestamp", async () => {
    const { forwardLeadToOps, signBody } = await import("@/server/ops-forward");
    process.env.OPS_INTAKE_URL = "http://127.0.0.1:3020/api/intake/website";
    process.env.OPS_INTAKE_SECRET = secret;
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await forwardLeadToOps(lead, fetcher as unknown as typeof fetch)).toBe("sent");
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string>; body: string }];
    const timestamp = init.headers["X-Timestamp"];
    expect(Math.abs(Date.now() / 1000 - Number(timestamp))).toBeLessThan(5);
    expect(init.headers["X-Signature"]).toBe(signBody(secret, timestamp, init.body));
    expect(JSON.parse(init.body)).toEqual({ externalId: lead.id, name: "منى", phone: "+201000000002", email: null, service: null, message: null });
  });

  it("reports failure (never throws) when the CRM is down, slow or refuses", async () => {
    const { forwardLeadToOps } = await import("@/server/ops-forward");
    process.env.OPS_INTAKE_URL = "http://127.0.0.1:3020/api/intake/website";
    process.env.OPS_INTAKE_SECRET = secret;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await forwardLeadToOps(lead, (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch)).toBe("failed");
    expect(await forwardLeadToOps(lead, (async () => new Response("no", { status: 401 })) as unknown as typeof fetch)).toBe("failed");
    quiet.mockRestore();
    delete process.env.OPS_INTAKE_URL;
    delete process.env.OPS_INTAKE_SECRET;
  });
});

describe("project pages: addresses, neighbours and the menu on inner pages", async () => {
  const { findWork, isPublishable, slugify, withSlugs } = await import("@/lib/work");
  const { linkFromInnerPage } = await import("@/lib/site-chrome");
  const { ar } = await import("@/content/ar");
  const item = (over: Partial<(typeof ar.work.items)[number]>) => ({ ...ar.work.items[0], slug: "", sample: false, ...over });

  it("makes a readable address from an Arabic or English title when the slug is empty", () => {
    expect(slugify("متجر النور 2")).toBe("متجر-النور-2");
    expect(slugify("  مَتْجَر   النور!! ")).toBe("متجر-النور");
    expect(slugify("Nour Store — v2")).toBe("nour-store-v2");
    expect(slugify("!!!")).toBe("");
  });

  it("never gives two projects the same address", () => {
    const all = withSlugs([item({ title: "متجر" }), item({ title: "متجر" }), item({ title: "x", slug: "shop" }), item({ title: "!!!" })]);
    expect(all.map((w) => w.slugValue)).toEqual(["متجر", "متجر-2", "shop", "project-4"]);
    expect(all[0].href).toBe(`/work/${encodeURIComponent("متجر")}`);
  });

  it("finds a project by its (possibly percent-encoded) address, with the projects before and after it", () => {
    const items = [item({ slug: "a" }), item({ slug: "b", title: "متجر النور" }), item({ slug: "c" })];
    expect(findWork(items, "b")).toMatchObject({ index: 1, item: { slugValue: "b" }, prev: { slugValue: "a" }, next: { slugValue: "c" } });
    expect(findWork(items, "a")).toMatchObject({ prev: null, next: { slugValue: "b" } });
    expect(findWork([item({ title: "متجر النور" })], encodeURIComponent("متجر-النور"))?.index).toBe(0);
    expect(findWork(items, "nope")).toBeNull();
    expect(findWork(items, "%E0%A4%A")).toBeNull(); // malformed encoding
  });

  it("only real projects are published to search engines", () => {
    expect(isPublishable(item({ sample: false }))).toBe(true);
    expect(isPublishable(item({ sample: true }))).toBe(false);
  });

  it("menu links on an inner page lead back to the home page's sections, and «أعمالنا» to the full list", () => {
    expect(linkFromInnerPage("#services")).toBe("/#services");
    expect(linkFromInnerPage("#work")).toBe("/work");
    expect(linkFromInnerPage("https://wa.me/1")).toBe("https://wa.me/1");
    expect(linkFromInnerPage("/privacy")).toBe("/privacy");
  });
});
