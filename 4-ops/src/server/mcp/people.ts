import "server-only";
import { z } from "zod";
import { createUserAction, saveCompanyAction } from "@/app/actions/admin";
import { addLeaveAction, checkInAction, checkOutAction, deleteLeaveAction, deleteRecordAction, saveRecordAction, saveShiftAction } from "@/app/actions/attendance";
import { LEAVE_KINDS, isValidMonth, monthOf } from "@/lib/attendance-rules";
import { ROLES } from "@/lib/crm-rules";
import { todayInCairo } from "@/lib/dates";
import { leavesOverlapping, monthReport, myToday, personMonth, todayBoard } from "../attendance";
import { getCompany } from "../company";
import { can } from "../permissions";
import { listUsers, setActive, setRole } from "../users";
import { ToolError, act, found, need, tool } from "./context";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "معرّف غير صالح (UUID)");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ بصيغة YYYY-MM-DD");
const time = z.string().regex(/^\d{2}:\d{2}$/, "وقت بصيغة HH:MM");
const month = z.string().refine(isValidMonth, "شهر بصيغة YYYY-MM");

export const peopleTools = [
  tool({
    name: "whoami",
    title: "Who am I",
    description: "صاحب المفتاح الحالي ودوره وما يقدر يعمله. The key's owner, role and permissions.",
    input: z.object({}),
    run: async (_args, user) => ({ id: user.id, name: user.name, email: user.email, role: user.role }),
  }),

  // ---------- attendance ----------
  tool({
    name: "attendance_today",
    title: "Attendance today",
    description: "حضور اليوم: للمدير/المالك الفريق كله، وللموظف يومه هو. Today's attendance.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "attendance.record");
      if (can(user.role, "attendance.view_all")) return { date: todayInCairo(), team: await todayBoard() };
      return { date: todayInCairo(), me: await myToday(user.id) };
    },
  }),
  tool({
    name: "attendance_month",
    title: "Monthly attendance",
    description: "تقرير شهر (YYYY-MM): للفريق كله، أو لشخص بـ userId. الموظف يرى نفسه فقط.",
    input: z.object({ month: month.optional(), userId: id.optional() }),
    run: async ({ month: asked, userId }, user) => {
      need(user, "attendance.record");
      const m = asked ?? monthOf(todayInCairo());
      const all = can(user.role, "attendance.view_all");
      if (!all || userId) return { month: m, person: found(await personMonth(all ? (userId ?? user.id) : user.id, m), "جدول الحضور لهذا الشخص") };
      return { month: m, team: await monthReport(m) };
    },
  }),
  tool({
    name: "list_leaves",
    title: "List leaves",
    description: "الإجازات بين تاريخين (YYYY-MM-DD). Leaves overlapping a date range.",
    input: z.object({ from: isoDate, to: isoDate, userId: id.optional() }),
    run: async ({ from, to, userId }, user) => {
      need(user, "attendance.record");
      return leavesOverlapping(from, to, can(user.role, "attendance.view_all") ? userId : user.id);
    },
  }),
  tool({
    name: "check_in",
    title: "Check in (myself)",
    description: "تسجيل حضوري أنا (صاحب المفتاح) الآن. Records the key owner's own check-in.",
    write: true,
    input: z.object({}),
    run: async (_args, user) => act(user, checkInAction, {}),
  }),
  tool({
    name: "check_out",
    title: "Check out (myself)",
    description: "تسجيل انصرافي أنا الآن. Records the key owner's own check-out.",
    write: true,
    input: z.object({}),
    run: async (_args, user) => act(user, checkOutAction, {}),
  }),
  tool({
    name: "save_shift",
    title: "Set a person's shift",
    description: "وردية شخص: بداية ونهاية (HH:MM)، أيام العمل (0 = الأحد ... 6 = السبت)، ودقائق السماح.",
    write: true,
    input: z.object({ userId: id, startTime: time, endTime: time, workDays: z.array(z.number().int().min(0).max(6)).min(1), graceMinutes: z.number().int().min(0).max(120).default(10) }),
    run: async (args, user) => act(user, saveShiftAction, { userId: args.userId, startTime: args.startTime, endTime: args.endTime, graceMinutes: args.graceMinutes, workDays: args.workDays.map(String) }),
  }),
  tool({
    name: "fix_attendance_record",
    title: "Fix an attendance record",
    description: "تصحيح يوم حضور لشخص (بسبب يُحفظ في السجل). checkOut may be empty.",
    write: true,
    input: z.object({ userId: id, date: isoDate, checkIn: time, checkOut: time.optional(), reason: z.string() }),
    run: async (args, user) => act(user, saveRecordAction, { userId: args.userId, date: args.date, checkIn: args.checkIn, checkOut: args.checkOut ?? "", reason: args.reason }),
  }),
  tool({
    name: "delete_attendance_record",
    title: "Delete an attendance record",
    description: "حذف يوم حضور مسجّل بالغلط (بسبب يُحفظ في السجل).",
    write: true,
    destructive: true,
    input: z.object({ userId: id, date: isoDate, reason: z.string() }),
    run: async (args, user) => act(user, deleteRecordAction, args),
  }),
  tool({
    name: "add_leave",
    title: "Add a leave",
    description: `إجازة لشخص (userId) أو للكل (everyone=true). kinds: ${LEAVE_KINDS.join(", ")}.`,
    write: true,
    input: z.object({ kind: z.enum(LEAVE_KINDS), startDate: isoDate, endDate: isoDate, userId: id.optional(), everyone: z.boolean().default(false), note: z.string().default("") }),
    run: async (args, user) => {
      if (!args.everyone && !args.userId) throw new ToolError("حدّد userId، أو everyone=true لإجازة للكل.");
      return act(user, addLeaveAction, { kind: args.kind, startDate: args.startDate, endDate: args.endDate, note: args.note, userId: args.userId ?? "", everyone: args.everyone ? "1" : "" });
    },
  }),
  tool({
    name: "delete_leave",
    title: "Delete a leave",
    description: "حذف إجازة. Deletes a leave by id (see list_leaves).",
    write: true,
    destructive: true,
    input: z.object({ leaveId: id }),
    run: async ({ leaveId }, user) => act(user, deleteLeaveAction, { id: leaveId }),
  }),

  // ---------- company ----------
  tool({
    name: "get_company",
    title: "Company details",
    description: "بيانات الشركة المطبوعة على العروض والعقود والفواتير.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "company.edit");
      return getCompany();
    },
  }),
  tool({
    name: "update_company",
    title: "Update company details",
    description: "تعديل بيانات الشركة (كل الحقول).",
    write: true,
    input: z.object({ name: z.string(), address: z.string().default(""), email: z.string().default(""), phone: z.string().default(""), taxNumber: z.string().default("") }),
    run: async (args, user) => act(user, saveCompanyAction, args),
  }),

  // ---------- accounts ----------
  tool({
    name: "list_users",
    title: "List team accounts",
    description: "حسابات الفريق وأدوارهم وحالتهم. Team accounts.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "users.manage");
      return listUsers();
    },
  }),
  tool({
    name: "create_user",
    title: "Create a team account",
    description: `حساب جديد لعضو في الفريق. roles: ${ROLES.join(", ")}. لا يرجّع باسورد: المالك يحصل على باسورد مؤقت من Ops ← الفريق ← «باسورد جديد».`,
    write: true,
    input: z.object({ email: z.string(), name: z.string(), role: z.enum(ROLES) }),
    run: async (args, user) => {
      // The action's message carries the temporary password: it is dropped here and never leaves the server.
      await act(user, createUserAction, args);
      return { created: true, next: "افتح Ops ← الفريق، واضغط «باسورد جديد» لهذا الحساب لتحصل على باسورد مؤقت تسلّمه له بنفسك." };
    },
  }),
  tool({
    name: "set_user_role",
    title: "Change an account's role",
    description: `تغيير دور حساب. roles: ${ROLES.join(", ")}. لا يمكن تغيير دورك أنت، ولازم يفضل مالك نشط.`,
    write: true,
    input: z.object({ userId: id, role: z.enum(ROLES) }),
    run: async ({ userId, role }, user) => {
      need(user, "users.manage");
      const result = await setRole(userId, role, user.id);
      if (!result.ok) throw new ToolError(result.error);
      return { updated: true, role };
    },
  }),
  tool({
    name: "set_user_active",
    title: "Enable or disable an account",
    description: "إيقاف حساب (يخرجه من كل الأجهزة) أو تفعيله. لا يمكن إيقاف حسابك أنت.",
    write: true,
    destructive: true,
    input: z.object({ userId: id, active: z.boolean() }),
    run: async ({ userId, active }, user) => {
      need(user, "users.manage");
      const result = await setActive(userId, active, user.id);
      if (!result.ok) throw new ToolError(result.error);
      return { updated: true, active };
    },
  }),
];
