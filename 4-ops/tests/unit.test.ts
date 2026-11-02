import { describe, expect, it } from "vitest";
import { STAGES, normalizePhone, type Role } from "@/lib/crm-rules";
import { validateTransition } from "@/lib/crm-flow";
import { computeTotals, formatMoney, milestonesAreComplete, parseMoney, percentOf, splitPayments, toDecimalText } from "@/lib/money";
import { PLACEHOLDER_RE, blockingProblems, countPlaceholders, type ProposalDraft } from "@/lib/proposal-rules";
import { TEMPLATES, templateFor } from "@/lib/proposal-templates";
import { MAX_SKEW_SECONDS, intakeSchema, signIntake, verifyIntake } from "@/server/intake";
import { PERMISSIONS, can, canAccessContract, canAccessDeal, canAccessTask, type Permission } from "@/server/permissions";
import { contractProblems, fillTokens, formatClock, formatWorkDays, type ContractFacts } from "@/lib/contract-rules";
import { CLIENT_TOKENS, clientContractProblems, fillClientTokens, formatWeeks, paidPerMilestone, paymentSummary, takesPayments, type ClientContractFacts } from "@/lib/client-contract-rules";
import { validateTaskTransition } from "@/lib/task-flow";
import { TASK_STATUSES, type TaskStatus } from "@/lib/task-rules";
import { addDays, cairoMinutes, isIsoDate, isOverdue, todayInCairo } from "@/lib/dates";
import { dayStatus, daysOfMonth, formatDuration, isTime, isValidMonth, lateMinutesFor, lateMinutesOnDay, shiftMonth, summarizeMonth, weekdayOf } from "@/lib/attendance-rules";
import { planFromPhases } from "@/lib/project-plan";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/server/password";

describe("money (integers, never floats)", () => {
  it("adds up items, applies the discount BEFORE tax, and rounds tax half up", () => {
    const items = [{ quantity: 2, unitPriceMinor: 1_000_00 }, { quantity: 1, unitPriceMinor: 333_33 }];
    expect(computeTotals(items, 0, null)).toEqual({ subtotalMinor: 2_333_33, discountMinor: 0, taxableMinor: 2_333_33, taxMinor: 0, totalMinor: 2_333_33 });
    const taxed = computeTotals(items, 333_33, 1400);
    expect(taxed.taxableMinor).toBe(2_000_00);
    expect(taxed.taxMinor).toBe(280_00);
    expect(taxed.totalMinor).toBe(2_280_00);
    // 14% of 0.05 = 0.007 -> 0.01 (half up); 14% of 0.03 = 0.0042 -> 0.00
    expect(percentOf(5, 1400)).toBe(1);
    expect(percentOf(3, 1400)).toBe(0);
    expect(percentOf(50, 1000)).toBe(5);
  });

  it("never lets a discount exceed the subtotal or go negative", () => {
    const items = [{ quantity: 1, unitPriceMinor: 100_00 }];
    expect(computeTotals(items, 500_00, 1400).totalMinor).toBe(0);
    expect(computeTotals(items, -50_00, null).totalMinor).toBe(100_00);
  });

  it("keeps full precision on big amounts (no float drift)", () => {
    const big = [{ quantity: 10000, unitPriceMinor: 100_000_000_000 }];
    const totals = computeTotals(big, 0, 1400);
    expect(totals.subtotalMinor).toBe(1_000_000_000_000_000);
    expect(totals.taxMinor).toBe(140_000_000_000_000);
  });

  it("splits payments so they add up to the total to the last piastre", () => {
    for (const total of [1, 2, 99, 100, 1_00_001, 7_777_77]) {
      const parts = splitPayments(total, [3333, 3333, 3334]);
      expect(parts.reduce((a, b) => a + b, 0), String(total)).toBe(total);
    }
    expect(splitPayments(100_00, [4000, 3000, 3000])).toEqual([40_00, 30_00, 30_00]);
    expect(splitPayments(0, [])).toEqual([]);
    expect(milestonesAreComplete([4000, 3000, 3000])).toBe(true);
    expect(milestonesAreComplete([4000, 3000])).toBe(false);
    expect(milestonesAreComplete([])).toBe(false);
  });

  it("parses what people type: Arabic digits, separators, at most two decimals", () => {
    expect(parseMoney("1500")).toBe(150000);
    expect(parseMoney("1,500.5")).toBe(150050);
    expect(parseMoney("١٥٠٠٫٥٠")).toBe(150050);
    expect(parseMoney(" 0.07 ")).toBe(7);
    for (const bad of ["", "-5", "1.234", "abc", "1e5", "1..2", "٫٥", "1 2 3 4 5 6 7 8 9 0 1 2 3"]) expect(parseMoney(bad), bad).toBeNull();
    expect(toDecimalText(150050)).toBe("1500.50");
    expect(toDecimalText(150000)).toBe("1500");
    expect(toDecimalText(7)).toBe("0.07");
  });

  it("formats with Western digits and the currency", () => {
    expect(formatMoney(150050, "EGP")).toMatch(/1,500\.50/);
    expect(formatMoney(150050, "USD")).toMatch(/1,500\.50/);
  });
});

describe("pipeline transitions", () => {
  it("lets open stages move freely, in any direction", () => {
    for (const from of ["new", "contacted", "meeting", "proposal_sent", "negotiation"] as const) {
      for (const to of ["new", "contacted", "meeting", "proposal_sent", "negotiation", "won"] as const) {
        expect(validateTransition(from, to, null).ok, `${from}->${to}`).toBe(from !== to);
      }
    }
  });
  it("needs a real reason to lose, and nothing to win", () => {
    expect(validateTransition("negotiation", "lost", "").ok).toBe(false);
    expect(validateTransition("negotiation", "lost", " x ").ok).toBe(false);
    expect(validateTransition("negotiation", "lost", "x".repeat(301)).ok).toBe(false);
    expect(validateTransition("negotiation", "lost", "السعر").ok).toBe(true);
    expect(validateTransition("negotiation", "won", null).ok).toBe(true);
  });
  it("a closed deal can only be reopened, not flipped between won and lost", () => {
    expect(validateTransition("won", "lost", "السعر").ok).toBe(false);
    expect(validateTransition("lost", "won", null).ok).toBe(false);
    expect(validateTransition("won", "negotiation", null).ok).toBe(true);
    expect(validateTransition("lost", "new", null).ok).toBe(true);
    expect(STAGES).toHaveLength(7);
  });
});

describe("permissions", () => {
  const MATRIX: Record<Permission, Record<Role, boolean>> = {
    "deal.view_all": { owner: true, manager: true, employee: false },
    "deal.view_own": { owner: true, manager: true, employee: true },
    "deal.create": { owner: true, manager: true, employee: false },
    "deal.edit": { owner: true, manager: true, employee: false },
    "deal.move": { owner: true, manager: true, employee: false },
    "deal.assign": { owner: true, manager: true, employee: false },
    "deal.log_activity": { owner: true, manager: true, employee: true },
    "client.manage": { owner: true, manager: true, employee: false },
    "proposal.view": { owner: true, manager: true, employee: false },
    "proposal.edit": { owner: true, manager: true, employee: false },
    "proposal.export": { owner: true, manager: true, employee: false },
    "company.edit": { owner: true, manager: true, employee: false },
    "users.manage": { owner: true, manager: false, employee: false },
    "task.view_own": { owner: true, manager: true, employee: true },
    "task.view_all": { owner: true, manager: true, employee: false },
    "task.create": { owner: true, manager: true, employee: false },
    "task.edit": { owner: true, manager: true, employee: false },
    "task.assign": { owner: true, manager: true, employee: false },
    "task.close": { owner: true, manager: true, employee: false },
    "task.progress": { owner: true, manager: true, employee: true },
    "task.comment": { owner: true, manager: true, employee: true },
    "project.view_own": { owner: true, manager: true, employee: true },
    "project.view_all": { owner: true, manager: true, employee: false },
    "project.manage": { owner: true, manager: true, employee: false },
    "attendance.record": { owner: true, manager: true, employee: true },
    "attendance.view_all": { owner: true, manager: true, employee: false },
    "attendance.edit": { owner: true, manager: true, employee: false },
    "schedule.manage": { owner: true, manager: true, employee: false },
    "leave.manage": { owner: true, manager: true, employee: false },
    "contract.manage": { owner: true, manager: false, employee: false },
    "contract.respond": { owner: true, manager: true, employee: true },
    "client_contract.manage": { owner: true, manager: true, employee: false },
    "invoice.issue": { owner: true, manager: true, employee: false },
    "invoice.void": { owner: true, manager: false, employee: false },
  };
  it("matches the agreed table exactly, for every role and every permission", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
    for (const permission of Object.keys(MATRIX) as Permission[]) {
      for (const role of ["owner", "manager", "employee"] as Role[]) expect(can(role, permission), `${role} ${permission}`).toBe(MATRIX[permission][role]);
    }
  });
  it("an employee never sees prices: no proposal permission of any kind", () => {
    for (const permission of ["proposal.view", "proposal.edit", "proposal.export"] as const) expect(can("employee", permission)).toBe(false);
  });
  it("a contract is the owner's and its employee's only, and the employee never sees a draft", () => {
    const mine = { id: "u1", role: "employee" as const };
    const manager = { id: "u3", role: "manager" as const };
    expect(canAccessContract(mine, { userId: "u1", status: "sent" })).toBe(true);
    expect(canAccessContract(mine, { userId: "u1", status: "accepted" })).toBe(true);
    expect(canAccessContract(mine, { userId: "u1", status: "draft" })).toBe(false);
    expect(canAccessContract(mine, { userId: "u2", status: "sent" })).toBe(false);
    expect(canAccessContract(manager, { userId: "u1", status: "sent" })).toBe(false);
    expect(canAccessContract({ id: "o", role: "owner" }, { userId: "u1", status: "draft" })).toBe(true);
  });
  it("employees reach only their own deals; owners and managers reach all", () => {
    const mine = { id: "u1", role: "employee" as const };
    expect(canAccessDeal(mine, { ownerId: "u1" })).toBe(true);
    expect(canAccessDeal(mine, { ownerId: "u2" })).toBe(false);
    expect(canAccessDeal(mine, { ownerId: null })).toBe(false);
    for (const role of ["owner", "manager"] as const) expect(canAccessDeal({ id: "x", role }, { ownerId: null })).toBe(true);
  });
});

describe("proposal rules and templates", () => {
  const ready: ProposalDraft = {
    items: [{ title: "تصميم", quantity: 1, unitPriceMinor: 10_000_00 }],
    milestones: [{ title: "مقدم", percentBp: 5000 }, { title: "تسليم", percentBp: 5000 }],
    discountMinor: 0,
    taxRateBp: null,
    intro: "",
    sections: [{ title: "نظرة عامة", body: "نص كامل بلا فراغات" }],
    timeline: [{ title: "تنفيذ", weeks: 3 }],
  };
  it("a complete proposal has no blocking problems", () => expect(blockingProblems(ready)).toEqual([]));
  it("blocks: no items, zero total, discount above subtotal, payments not adding to 100%", () => {
    expect(blockingProblems({ ...ready, items: [] }).join()).toMatch(/بند واحد/);
    expect(blockingProblems({ ...ready, items: [{ title: "x", quantity: 1, unitPriceMinor: 0 }] }).join()).toMatch(/أكبر من صفر/);
    expect(blockingProblems({ ...ready, discountMinor: 20_000_00 }).join()).toMatch(/أكبر من/);
    expect(blockingProblems({ ...ready, milestones: [{ title: "x", percentBp: 9000 }] }).join()).toMatch(/100%/);
  });
  it("counts the [..] gaps left in the text", () => {
    expect(countPlaceholders({ ...ready, intro: "عرض لـ [اسم العميل] و[الهدف]" })).toBe(2);
    expect(countPlaceholders(ready)).toBe(0);
    expect("a [x] b".match(PLACEHOLDER_RE)).toBeNull(); // one-character gaps are not placeholders
  });
  it("every template is a draft: payments add to 100%, there are gaps to fill, and no money or guarantees are invented", () => {
    for (const [service, template] of Object.entries({ ...TEMPLATES, generic: templateFor(null) })) {
      expect(milestonesAreComplete(template.milestones.map((m) => m.percentBp)), service).toBe(true);
      expect(countPlaceholders({ intro: "", ...template }), service).toBeGreaterThan(0);
      const text = JSON.stringify(template);
      expect(text, service).not.toMatch(/\d[\d,.]*\s*(جنيه|دولار|ريال|EGP|USD|SAR|\$)/);
      expect(text, service).not.toMatch(/ضمان لمدة|سنة ضمان|\d+\s*(شهر|سنة) (دعم|ضمان)/);
    }
  });
  it("hands out independent copies, so editing one proposal never changes the template", () => {
    const a = templateFor("موقع إلكتروني");
    a.sections[0].title = "changed";
    expect(templateFor("موقع إلكتروني").sections[0].title).toBe("نظرة عامة");
  });
});

describe("website intake signatures", () => {
  const secret = "k".repeat(40);
  const body = JSON.stringify({ externalId: "abc12345", name: "منى", phone: "+201000000002" });
  const now = 1_800_000_000_000;
  const stamp = String(now / 1000);
  const good = signIntake(secret, stamp, body);
  const verify = (over: Partial<Parameters<typeof verifyIntake>[0]> = {}) => verifyIntake({ secret, timestamp: stamp, signature: good, rawBody: body, nowMs: now, ...over });

  it("accepts a correct, fresh signature", () => expect(verify()).toEqual({ ok: true }));
  it("rejects a tampered body, a wrong secret, a malformed or missing signature", () => {
    expect(verify({ rawBody: body.replace("منى", "x") })).toEqual({ ok: false, reason: "signature" });
    expect(verify({ secret: "z".repeat(40) })).toEqual({ ok: false, reason: "signature" });
    expect(verify({ signature: "sha256=" + "0".repeat(64) })).toEqual({ ok: false, reason: "signature" });
    expect(verify({ signature: "nonsense" })).toEqual({ ok: false, reason: "signature" });
    expect(verify({ signature: null })).toEqual({ ok: false, reason: "missing" });
    expect(verify({ timestamp: null })).toEqual({ ok: false, reason: "missing" });
  });
  it("rejects old and future timestamps (replay window), and a timestamp that was not signed", () => {
    expect(verify({ nowMs: now + (MAX_SKEW_SECONDS + 1) * 1000 })).toEqual({ ok: false, reason: "stale" });
    expect(verify({ nowMs: now - (MAX_SKEW_SECONDS + 1) * 1000 })).toEqual({ ok: false, reason: "stale" });
    expect(verify({ nowMs: now + (MAX_SKEW_SECONDS - 1) * 1000 }).ok).toBe(true);
    expect(verify({ timestamp: String(now / 1000 + 1) })).toEqual({ ok: false, reason: "signature" });
    expect(verify({ timestamp: "not-a-number" })).toEqual({ ok: false, reason: "stale" });
  });
  it("validates the lead payload and ignores service names it doesn't know", () => {
    const parsed = intakeSchema.safeParse({ externalId: "abc12345", name: " منى ", phone: "+٢٠ ١٠٠ ٠٠٠ ٠٠٠٢", email: null, service: "شيء غريب", message: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ name: "منى", phone: "+201000000002", email: null, service: null, message: null });
    expect(intakeSchema.safeParse({ externalId: "x", name: "منى", phone: "+201000000002" }).success).toBe(false);
    expect(intakeSchema.safeParse({ externalId: "abc12345", name: "منى", phone: "12" }).success).toBe(false);
    expect(intakeSchema.safeParse({ externalId: "abc12345", name: "منى", phone: "+201000000002", email: "nope" }).success).toBe(false);
  });
  it("phone numbers are normalized the same way everywhere", () => expect(normalizePhone("(۰۱۰) 123-4567")).toBe("0101234567"));
});

describe("passwords", () => {
  it("hash, verify, reject, and refuse hostile stored values", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    for (const stored of ["", "plain", "scrypt$999999999$8$1$YQ$YQ"]) expect(await verifyPassword("x", stored)).toBe(false);
    expect(await verifyPassword("x", await dummyHash())).toBe(false);
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("a perfectly fine passphrase")).toBeNull();
  });
});

describe("task permissions", () => {
  it("an employee reaches only tasks assigned to them; owners and managers reach all", () => {
    const me = { id: "u1", role: "employee" as const };
    expect(canAccessTask(me, { assigneeId: "u1" })).toBe(true);
    expect(canAccessTask(me, { assigneeId: "u2" })).toBe(false);
    expect(canAccessTask(me, { assigneeId: null })).toBe(false);
    for (const role of ["owner", "manager"] as const) expect(canAccessTask({ id: "x", role }, { assigneeId: null })).toBe(true);
  });
});

describe("task status transitions", () => {
  const ok = (role: Role, from: TaskStatus, to: TaskStatus, reason: string | null = null) => validateTaskTransition(role, from, to, reason).ok;

  it("owners and managers can move a task anywhere, close it, and reopen it", () => {
    for (const role of ["owner", "manager"] as const) {
      for (const from of TASK_STATUSES) {
        for (const to of TASK_STATUSES) {
          const expected = from !== to;
          expect(ok(role, from, to, "عطلان في الدومين"), `${role} ${from}->${to}`).toBe(expected);
        }
      }
    }
  });

  it("an employee moves a task among todo / doing / review / blocked, never to or from done", () => {
    const open: TaskStatus[] = ["todo", "doing", "review", "blocked"];
    for (const from of open) for (const to of open) expect(ok("employee", from, to, "سبب"), `${from}->${to}`).toBe(from !== to);
    for (const from of open) expect(ok("employee", from, "done"), `${from}->done`).toBe(false);
    for (const to of open) expect(ok("employee", "done", to, "سبب"), `done->${to}`).toBe(false);
    expect(validateTaskTransition("employee", "review", "done", null)).toMatchObject({ ok: false, error: expect.stringContaining("المدير") });
  });

  it("blocking needs a real reason from everybody; the reason is length-limited", () => {
    for (const role of ["owner", "manager", "employee"] as const) {
      expect(ok(role, "doing", "blocked", null), role).toBe(false);
      expect(ok(role, "doing", "blocked", "   "), role).toBe(false);
      expect(ok(role, "doing", "blocked", "x"), role).toBe(false);
      expect(ok(role, "doing", "blocked", "x".repeat(301)), role).toBe(false);
      expect(ok(role, "doing", "blocked", "مستني بيانات العميل"), role).toBe(true);
    }
  });
});

describe("calendar days (no time zones in due dates)", () => {
  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", 0)).toBe("2026-01-01");
  });
  it("validates ISO days strictly", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "26-01-01", "2026-1-1", "", "tomorrow"]) expect(isIsoDate(bad), bad).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("today is the Cairo date, not the server's", () => {
    expect(todayInCairo(new Date("2026-06-15T21:30:00Z"))).toBe("2026-06-16"); // already past midnight in Cairo (UTC+3 in summer)
    expect(todayInCairo(new Date("2026-01-15T21:30:00Z"))).toBe("2026-01-15"); // UTC+2 in winter: still the 15th... 23:30
    expect(todayInCairo(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-16");
  });
  it("a task is late only if it has a due day before today and isn't done", () => {
    expect(isOverdue("2026-01-01", "doing", "2026-01-02")).toBe(true);
    expect(isOverdue("2026-01-02", "doing", "2026-01-02")).toBe(false); // due today is not late yet
    expect(isOverdue("2026-01-01", "done", "2026-01-02")).toBe(false);
    expect(isOverdue(null, "todo", "2026-01-02")).toBe(false);
    expect(isOverdue("2026-01-01", "blocked", "2026-01-02")).toBe(true);
  });
});

describe("project plan from the proposal's phases", () => {
  it("one task per phase, due on the last day of the week each phase ends in", () => {
    expect(planFromPhases("2026-01-01", [{ title: "تحليل", weeks: 2 }, { title: "تنفيذ", weeks: 4 }, { title: "إطلاق", weeks: 1 }])).toEqual([
      { title: "تحليل", dueDate: "2026-01-14" },
      { title: "تنفيذ", dueDate: "2026-02-11" },
      { title: "إطلاق", dueDate: "2026-02-18" },
    ]);
    expect(planFromPhases("2026-01-01", [])).toEqual([]);
    expect(planFromPhases("2026-12-28", [{ title: "x", weeks: 1 }])[0].dueDate).toBe("2027-01-03");
  });
});

describe("date-only values are calendar days", () => {
  it("print the same day whatever the server's time zone is", async () => {
    const { formatDate, formatDateLong } = await import("@/lib/format");
    expect(formatDate("2026-10-30")).toBe(formatDate(new Date("2026-10-30T12:00:00Z")));
    expect(formatDateLong("2026-10-30")).toContain("30");
    expect(formatDateLong("2026-01-01")).toContain("1");
  });
});

describe("attendance rules", () => {
  const shift = { startTime: "09:00", endTime: "17:00", workDays: [0, 1, 2, 3, 4], graceMinutes: 15, trackedSince: "2026-03-01" };
  const rec = (inH: number, inM: number, out: [number, number] | null, late: number) => ({
    checkIn: new Date(Date.UTC(2026, 2, 10, inH, inM)),
    checkOut: out ? new Date(Date.UTC(2026, 2, 10, out[0], out[1])) : null,
    lateMinutes: late,
  });

  it("late means more than the grace period after the shift start, counted from the start", () => {
    expect(lateMinutesFor(8 * 60 + 50, shift)).toBe(0);
    expect(lateMinutesFor(9 * 60 + 15, shift)).toBe(0);
    expect(lateMinutesFor(9 * 60 + 16, shift)).toBe(16);
    expect(lateMinutesFor(11 * 60, shift)).toBe(120);
    expect(lateMinutesFor(9 * 60 + 5, { ...shift, graceMinutes: 0 })).toBe(5);
  });

  it("only working days can be late: a rest day check-in is never late", () => {
    expect(lateMinutesOnDay("2026-03-10", 11 * 60, shift)).toBe(120); // Tuesday
    expect(lateMinutesOnDay("2026-03-13", 11 * 60, shift)).toBe(0); // Friday
  });

  it("reads the weekday from a calendar day (2026-03-10 is a Tuesday; the 13th a Friday)", () => {
    expect(weekdayOf("2026-03-10")).toBe(2);
    expect(weekdayOf("2026-03-13")).toBe(5);
    expect(weekdayOf("2026-03-15")).toBe(0);
  });

  it("classifies a day: record beats everything, rest days beat leave, then past/today/future", () => {
    const base = { today: "2026-03-10", nowMinutes: 12 * 60, schedule: shift, record: null, onLeave: false };
    const status = (over: Partial<Parameters<typeof dayStatus>[0]>) => dayStatus({ ...base, date: "2026-03-09", ...over });
    expect(status({ record: rec(7, 0, null, 0) })).toBe("present");
    expect(status({ record: rec(7, 30, null, 30) })).toBe("late");
    expect(status({ record: rec(7, 0, null, 0), onLeave: true })).toBe("present");
    expect(status({})).toBe("absent");
    expect(status({ onLeave: true })).toBe("leave");
    expect(status({ date: "2026-03-13", onLeave: true })).toBe("off");
    expect(status({ date: "2026-03-13" })).toBe("off");
    expect(status({ date: "2026-02-20" })).toBe("before");
    expect(status({ date: "2026-02-20", record: rec(7, 0, null, 0) })).toBe("present");
    expect(status({ date: "2026-03-11" })).toBe("upcoming");
    expect(status({ date: "2026-03-10" })).toBe("missing");
    expect(status({ date: "2026-03-10", nowMinutes: 9 * 60 + 15 })).toBe("pending");
    expect(status({ date: "2026-03-10", nowMinutes: 9 * 60 + 16 })).toBe("missing");
  });

  it("adds a month up: days, late days and minutes, absences, leave, hours, and forgotten check-outs", () => {
    const records = new Map([
      ["2026-03-02", rec(7, 0, [15, 0], 0)], // Mon: 8h
      ["2026-03-03", rec(7, 30, [15, 30], 30)], // Tue: late 30, 8h
      ["2026-03-04", rec(7, 0, null, 0)], // Wed: forgot to check out
    ]);
    const s = summarizeMonth({ month: "2026-03", today: "2026-03-10", nowMinutes: 12 * 60, schedule: shift, records, leaveDates: new Set(["2026-03-05", "2026-03-08", "2026-03-13"]) });
    expect(s.days).toHaveLength(31);
    expect(s.presentDays).toBe(3);
    expect(s.lateDays).toBe(1);
    expect(s.lateMinutes).toBe(30);
    expect(s.workedMinutes).toBe(960);
    expect(s.noCheckoutDays).toBe(1);
    expect(s.leaveDays).toBe(2); // the 5th (Thu) and the 8th (Sun); the 13th is a rest day
    // working days before today with nothing: Mar 1 (Sun), Mar 9 (Mon). Today (Tue 10th) is not counted yet.
    expect(s.absentDays).toBe(2);
  });

  it("knows months: length, neighbours, validation", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-3")).toBe(false);
    expect(isTime("09:30")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(formatDuration(95)).toBe("1:35");
  });

  it("reads the office clock in Cairo, summer and winter", () => {
    expect(cairoMinutes(new Date("2026-03-10T07:20:00Z"))).toBe(9 * 60 + 20);
    expect(cairoMinutes(new Date("2026-07-10T07:20:00Z"))).toBe(10 * 60 + 20);
  });
});

describe("contract rules", () => {
  const facts: ContractFacts = { employeeName: "سارة علي", jobTitle: "مبيعات", startDate: "2026-11-15", workStart: "09:00", workEnd: "17:30", workDays: [4, 0, 1], salaryMinor: 800000, currency: "EGP", commission: "5%" };

  it("reads shifts and days the way a person does", () => {
    expect(formatClock("09:00")).toBe("9:00 صباحًا");
    expect(formatClock("17:30")).toBe("5:30 مساءً");
    expect(formatClock("00:15")).toBe("12:15 صباحًا");
    expect(formatClock("12:00")).toBe("12:00 مساءً");
    expect(formatWorkDays([4, 0, 1])).toBe("الأحد، الاثنين، الخميس");
  });

  it("fills every known token and leaves an unknown one visible", () => {
    const text = fillTokens("من الساعة {بداية_العمل} إلى الساعة {نهاية_العمل}، أيام: {أيام_العمل}. {اسم_الموظف} {غلط}", facts);
    expect(text).toBe("من الساعة 9:00 صباحًا إلى الساعة 5:30 مساءً، أيام: الأحد، الاثنين، الخميس. سارة علي {غلط}");
    expect(fillTokens("{المرتب}", facts)).toBe("\u20668,000.00 EGP\u2069 شهريًا");
  });

  it("won't send a contract with holes in it", () => {
    const clauses = [{ title: "المهام", body: "- بيع" }];
    expect(contractProblems({ ...facts, clauses })).toEqual([]);
    expect(contractProblems({ ...facts, clauses, startDate: null })[0]).toContain("تاريخ البدء");
    expect(contractProblems({ ...facts, clauses, workDays: [] })[0]).toContain("أيام العمل");
    expect(contractProblems({ ...facts, clauses, salaryMinor: null, commission: " " })[0]).toContain("المقابل المادي");
    expect(contractProblems({ ...facts, clauses: [] })[0]).toContain("بند");
    // Commission only is fine, but then a clause can't print the (empty) salary.
    expect(contractProblems({ ...facts, salaryMinor: null, clauses })).toEqual([]);
    expect(contractProblems({ ...facts, salaryMinor: null, clauses: [{ title: "الأجر", body: "{المرتب}" }] })[0]).toContain("«الأجر»");
  });
});

describe("client contract rules", () => {
  const facts = (over: Partial<ClientContractFacts> = {}): ClientContractFacts => ({
    title: "موقع شركة النور",
    clientName: "شركة النور",
    companyName: "Coder Nation",
    proposalNumber: "P-2026-0001",
    totalMinor: 1_140_000,
    currency: "EGP",
    startDate: "2026-11-15",
    timeline: [{ weeks: 2 }, { weeks: 4 }, { weeks: 1 }],
    ...over,
  });

  it("fills every token, with amounts and numbers kept left-to-right inside Arabic text", () => {
    const body = CLIENT_TOKENS.map((t) => t.token).join(" | ");
    expect(fillClientTokens(body, facts())).toBe(
      "موقع شركة النور | شركة النور | Coder Nation | \u2066P-2026-0001\u2069 | \u206611,400.00 EGP\u2069 | 15 نوفمبر 2026 | 7 أسابيع",
    );
    expect(fillClientTokens("{غلط}", facts())).toBe("{غلط}");
  });

  it("spells weeks the Arabic way", () => {
    expect([0, 1, 2, 3, 10, 11].map(formatWeeks)).toEqual(["", "أسبوع واحد", "أسبوعان", "3 أسابيع", "10 أسابيع", "11 أسبوعًا"]);
  });

  it("won't let a contract with a gap, an empty token or no start date be marked ready", () => {
    const clauses = [{ title: "موضوع العقد", body: "تنفيذ {عنوان_المشروع} بقيمة {إجمالي_العقد}" }];
    expect(clientContractProblems({ ...facts(), clauses })).toEqual([]);
    expect(clientContractProblems({ ...facts({ startDate: null }), clauses })).toEqual(["حدد تاريخ بدء التنفيذ"]);
    expect(clientContractProblems({ ...facts(), clauses: [] })).toEqual(["العقد لازم يبقى فيه بند واحد على الأقل"]);
    expect(clientContractProblems({ ...facts({ timeline: [] }), clauses: [{ title: "المدة", body: "مدته {مدة_التنفيذ}" }] })[0]).toContain("مدة التنفيذ");
    expect(clientContractProblems({ ...facts(), clauses: [{ title: "السرية", body: "لمدة [المدة] بعد انتهائه" }] })).toEqual(["البند «السرية» فيه فراغ لسه ما اتملاش: [المدة]"]);
    // The regex is global: checking twice in a row must give the same answer.
    expect(clientContractProblems({ ...facts(), clauses: [{ title: "السرية", body: "[المدة]" }] })).toHaveLength(1);
  });

  it("counts only live invoices as paid, per contract and per payment of the schedule", () => {
    const invoices = [
      { amountMinor: 400_000, status: "issued" as const, milestoneIndex: 0 },
      { amountMinor: 100_000, status: "void" as const, milestoneIndex: 0 },
      { amountMinor: 50_000, status: "issued" as const, milestoneIndex: 1 },
      { amountMinor: 10_000, status: "issued" as const, milestoneIndex: null },
    ];
    expect(paymentSummary(1_000_000, invoices)).toEqual({ paidMinor: 460_000, remainingMinor: 540_000 });
    expect(paymentSummary(100, [{ amountMinor: 100, status: "issued" }])).toEqual({ paidMinor: 100, remainingMinor: 0 });
    expect(paidPerMilestone(3, invoices)).toEqual([400_000, 50_000, 0]);
    expect(["draft", "ready", "signed", "cancelled"].map((s) => takesPayments(s as never))).toEqual([false, true, true, false]);
  });
});
