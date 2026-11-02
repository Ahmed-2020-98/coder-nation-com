import "server-only";
import { z } from "zod";
import { addActivityAction, addContactAction, addFollowUpAction, assignDealAction, completeFollowUpAction, createDealAction, moveDealAction, saveClientAction, updateDealAction } from "@/app/actions/crm";
import { ACTIVITY_KINDS, CURRENCIES, SERVICES, STAGES, STAGE_LABEL } from "@/lib/crm-rules";
import { formatMoney } from "@/lib/money";
import { dealIdOfFollowUp, dealsOfClient, getClient, getDeal, listActivities, listClients, listDeals, listFollowUps, stageCounts } from "../crm";
import { canAccessDeal, can } from "../permissions";
import { listProposals } from "../proposals";
import type { TokenUser } from "../api-tokens";
import { ToolError, act, found, idFrom, need, tool } from "./context";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "معرّف غير صالح (UUID)");
const money = (minor: number | null, currency: string | null) => (minor === null || !currency ? null : { amountMinor: minor, formatted: formatMoney(minor, currency as never) });

/** A deal the user may see (employees: only theirs), or a ToolError. */
async function dealFor(user: TokenUser, dealId: string) {
  const deal = await getDeal(dealId);
  if (!deal || !canAccessDeal(user, deal)) throw new ToolError("الصفقة غير موجودة، أو ليست مسندة إليك.");
  return deal;
}

export const crmTools = [
  tool({
    name: "search",
    title: "Search clients and deals",
    description: "بحث سريع بالاسم أو الموبايل أو الإيميل في العملاء والصفقات. Quick search across clients and deals.",
    input: z.object({ query: z.string().min(2).max(100) }),
    run: async ({ query }, user) => {
      need(user, "deal.view_own");
      const q = query.trim();
      const own = !can(user.role, "deal.view_all");
      const [clients, deals] = await Promise.all([can(user.role, "client.manage") ? listClients(q) : Promise.resolve([]), listDeals({ q, ownerId: own ? user.id : undefined })]);
      return {
        clients: clients.slice(0, 20),
        deals: deals.slice(0, 20).map((deal) => ({ id: deal.id, title: deal.title, clientName: deal.clientName, stage: deal.stage, stageLabel: STAGE_LABEL[deal.stage], ownerName: deal.ownerName })),
      };
    },
  }),

  // ---------- clients ----------
  tool({
    name: "list_clients",
    title: "List clients",
    description: "قائمة العملاء، مع بحث اختياري بالاسم أو الموبايل أو الإيميل. Clients, optionally searched by name / phone / email.",
    input: z.object({ query: z.string().max(100).optional() }),
    run: async ({ query }, user) => {
      need(user, "client.manage");
      return listClients(query?.trim() || undefined);
    },
  }),
  tool({
    name: "get_client",
    title: "Get a client",
    description: "بيانات عميل كاملة: جهات الاتصال وصفقاته. A client with its contacts and deals.",
    input: z.object({ clientId: id }),
    run: async ({ clientId }, user) => {
      need(user, "client.manage");
      const client = found(await getClient(clientId), "العميل");
      return { ...client, deals: await dealsOfClient(clientId) };
    },
  }),
  tool({
    name: "create_client",
    title: "Create a client",
    description: "إضافة عميل جديد. Creates a client. Phone may use Arabic digits; it is normalised.",
    write: true,
    input: z.object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
    }),
    run: async (args, user) => {
      const result = await act(user, saveClientAction, { name: args.name, phone: args.phone ?? "", email: args.email ?? "", website: args.website ?? "", notes: args.notes ?? "" });
      return { created: true, clientId: idFrom(result.location) };
    },
  }),
  tool({
    name: "update_client",
    title: "Update a client",
    description: "تعديل بيانات عميل (كل الحقول تُرسل كاملة؛ اقرأ العميل أولًا بـ get_client). Replaces a client's details.",
    write: true,
    input: z.object({ clientId: id, name: z.string(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), notes: z.string().optional() }),
    run: async (args, user) => {
      await act(user, saveClientAction, { id: args.clientId, name: args.name, phone: args.phone ?? "", email: args.email ?? "", website: args.website ?? "", notes: args.notes ?? "" });
      return { updated: true };
    },
  }),
  tool({
    name: "add_contact",
    title: "Add a contact to a client",
    description: "إضافة جهة اتصال (شخص) لعميل. Adds a contact person to a client.",
    write: true,
    input: z.object({ clientId: id, name: z.string(), jobTitle: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }),
    run: async (args, user) => {
      await act(user, addContactAction, { clientId: args.clientId, name: args.name, jobTitle: args.jobTitle ?? "", phone: args.phone ?? "", email: args.email ?? "" });
      return { added: true };
    },
  }),

  // ---------- deals ----------
  tool({
    name: "list_deals",
    title: "List deals",
    description: `الصفقات (الموظف يرى صفقاته فقط). فلترة بالمرحلة أو المسؤول أو نص. Stages: ${STAGES.join(", ")}.`,
    input: z.object({ stage: z.enum(STAGES).optional(), ownerId: id.optional(), query: z.string().max(100).optional() }),
    run: async ({ stage, ownerId, query }, user) => {
      need(user, "deal.view_own");
      const own = !can(user.role, "deal.view_all");
      const deals = await listDeals({ ownerId: own ? user.id : ownerId, q: query?.trim() || undefined });
      return deals
        .filter((deal) => !stage || deal.stage === stage)
        .map((deal) => ({ ...deal, stageLabel: STAGE_LABEL[deal.stage], value: money(deal.valueMinor, deal.currency) }));
    },
  }),
  tool({
    name: "get_deal",
    title: "Get a deal",
    description: "صفقة كاملة: العميل، الأنشطة، المتابعات، العروض. A deal with its activities, follow-ups and proposals.",
    input: z.object({ dealId: id }),
    run: async ({ dealId }, user) => {
      const deal = await dealFor(user, dealId);
      const [activities, followUps, proposals] = await Promise.all([
        listActivities(dealId),
        listFollowUps({ dealId }),
        can(user.role, "proposal.view") ? listProposals(dealId) : Promise.resolve([]),
      ]);
      return {
        ...deal,
        stageLabel: STAGE_LABEL[deal.stage],
        value: money(deal.valueMinor, deal.currency),
        activities,
        followUps,
        proposals: proposals.map((p) => ({ id: p.id, number: p.number, status: p.status, title: p.title, total: money(p.totalMinor, p.currency) })),
      };
    },
  }),
  tool({
    name: "create_deal",
    title: "Create a deal",
    description: `صفقة جديدة لعميل موجود (clientId) أو عميل جديد (clientName + clientPhone/clientEmail). services: ${SERVICES.join(" / ")}. value بالجنيه/الدولار كنص مثل "15000" مع currency.`,
    write: true,
    input: z.object({
      title: z.string(),
      clientId: id.optional(),
      clientName: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      service: z.string().optional(),
      value: z.string().optional(),
      currency: z.enum(CURRENCIES).optional(),
      ownerId: id.optional(),
      message: z.string().optional(),
    }),
    run: async (args, user) => {
      if (!args.clientId && !args.clientName) throw new ToolError("حدّد clientId لعميل موجود، أو clientName لعميل جديد.");
      const result = await act(user, createDealAction, {
        title: args.title,
        clientId: args.clientId ?? "",
        clientName: args.clientName ?? "",
        clientPhone: args.clientPhone ?? "",
        clientEmail: args.clientEmail ?? "",
        service: args.service ?? "",
        value: args.value ?? "",
        currency: args.currency ?? "",
        ownerId: args.ownerId ?? "",
        message: args.message ?? "",
      });
      return { created: true, dealId: idFrom(result.location) };
    },
  }),
  tool({
    name: "update_deal",
    title: "Update a deal",
    description: "تعديل عنوان الصفقة ونوع المشروع والقيمة المتوقعة. Edits a deal's title, service and expected value.",
    write: true,
    input: z.object({ dealId: id, title: z.string(), service: z.string().optional(), value: z.string().optional(), currency: z.enum(CURRENCIES).optional() }),
    run: async (args, user) => {
      await dealFor(user, args.dealId);
      await act(user, updateDealAction, { id: args.dealId, title: args.title, service: args.service ?? "", value: args.value ?? "", currency: args.currency ?? "" });
      return { updated: true };
    },
  }),
  tool({
    name: "assign_deal",
    title: "Assign a deal",
    description: "إسناد الصفقة لعضو في الفريق (ownerId)، أو إلغاء الإسناد بدون ownerId. Assigns (or unassigns) a deal.",
    write: true,
    input: z.object({ dealId: id, ownerId: id.optional() }),
    run: async ({ dealId, ownerId }, user) => {
      await act(user, assignDealAction, { id: dealId, ownerId: ownerId ?? "" });
      return { assigned: true };
    },
  }),
  tool({
    name: "move_deal",
    title: "Move a deal to a stage",
    description: `نقل الصفقة لمرحلة. للمرحلة lost لازم lostReason. Stages: ${STAGES.join(", ")}.`,
    write: true,
    input: z.object({ dealId: id, stage: z.enum(STAGES), lostReason: z.string().optional() }),
    run: async ({ dealId, stage, lostReason }, user) => {
      await dealFor(user, dealId);
      await act(user, moveDealAction, { id: dealId, stage, lostReason: lostReason ?? "" });
      return { moved: true, stage, stageLabel: STAGE_LABEL[stage] };
    },
  }),
  tool({
    name: "add_activity",
    title: "Log an activity on a deal",
    description: `تسجيل نشاط على صفقة (مكالمة، اجتماع، واتساب...). kinds: ${ACTIVITY_KINDS.join(", ")}.`,
    write: true,
    input: z.object({ dealId: id, kind: z.enum(ACTIVITY_KINDS), body: z.string() }),
    run: async ({ dealId, kind, body }, user) => {
      await dealFor(user, dealId);
      await act(user, addActivityAction, { id: dealId, kind, body });
      return { logged: true };
    },
  }),
  tool({
    name: "list_follow_ups",
    title: "List follow-ups",
    description: "المتابعات المفتوحة (أو كلها). الموظف يرى متابعاته فقط. Open (or all) follow-ups.",
    input: z.object({ dealId: id.optional(), openOnly: z.boolean().default(true) }),
    run: async ({ dealId, openOnly }, user) => {
      need(user, "deal.view_own");
      if (dealId) await dealFor(user, dealId);
      const own = !can(user.role, "deal.view_all");
      return listFollowUps({ dealId, openOnly, assigneeId: own ? user.id : undefined, limit: 200 });
    },
  }),
  tool({
    name: "add_follow_up",
    title: "Schedule a follow-up",
    description: "موعد متابعة على صفقة. dueAt بصيغة ISO 8601 بتوقيت القاهرة مثل 2026-11-05T14:30:00+02:00.",
    write: true,
    input: z.object({ dealId: id, dueAt: z.string(), note: z.string().max(500).optional() }),
    run: async ({ dealId, dueAt, note }, user) => {
      await dealFor(user, dealId);
      if (Number.isNaN(new Date(dueAt).getTime())) throw new ToolError("dueAt غير صالح، استخدم ISO 8601.");
      await act(user, addFollowUpAction, { id: dealId, dueAt, note: note ?? "" });
      return { scheduled: true };
    },
  }),
  tool({
    name: "complete_follow_up",
    title: "Complete a follow-up",
    description: "تعليم متابعة بأنها تمت. Marks a follow-up as done.",
    write: true,
    input: z.object({ followUpId: id }),
    run: async ({ followUpId }, user) => {
      const dealId = found(await dealIdOfFollowUp(followUpId), "المتابعة");
      await dealFor(user, dealId);
      await act(user, completeFollowUpAction, { id: followUpId });
      return { done: true };
    },
  }),
  tool({
    name: "pipeline_summary",
    title: "Pipeline summary",
    description: "عدد الصفقات في كل مرحلة (للموظف: صفقاته فقط). Deal counts per stage.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "deal.view_own");
      const counts = await stageCounts(can(user.role, "deal.view_all") ? undefined : user.id);
      return STAGES.map((stage) => ({ stage, label: STAGE_LABEL[stage], count: counts[stage] }));
    },
  }),
];
