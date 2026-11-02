import "server-only";
import { z } from "zod";
import { createProjectAction, startProjectAction, updateProjectAction } from "@/app/actions/projects";
import { createProposalAction, duplicateProposalAction, markSentAction, outcomeAction, saveProposalAction } from "@/app/actions/proposals";
import { addCommentAction, assignTaskAction, changeTaskStatusAction, createTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { CURRENCIES, PROPOSAL_STATUS_LABEL } from "@/lib/crm-rules";
import { computeTotals, formatMoney, formatPercentBp, splitPayments, toDecimalText } from "@/lib/money";
import { blockingProblems, countPlaceholders } from "@/lib/proposal-rules";
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "@/lib/task-rules";
import { can, canAccessTask } from "../permissions";
import { getProject, listProjects } from "../projects";
import { getProposal, listProposals } from "../proposals";
import { getTask, listEvents, listTasks } from "../tasks";
import { ToolError, act, found, idFrom, need, tool } from "./context";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "معرّف غير صالح (UUID)");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ بصيغة YYYY-MM-DD");

export const deliveryTools = [
  // ---------- proposals (technical + financial offer) ----------
  tool({
    name: "list_proposals",
    title: "List proposals",
    description: "العروض الفنية والمالية (كلها أو لصفقة). Proposals, all or of one deal, with totals.",
    input: z.object({ dealId: id.optional() }),
    run: async ({ dealId }, user) => {
      need(user, "proposal.view");
      const list = await listProposals(dealId);
      return list.map((p) => ({ ...p, statusLabel: PROPOSAL_STATUS_LABEL[p.status], total: formatMoney(p.totalMinor, p.currency) }));
    },
  }),
  tool({
    name: "get_proposal",
    title: "Get a proposal",
    description:
      "عرض كامل: الأقسام الفنية، الجدول الزمني، البنود، الدفعات، والإجماليات، وما يمنع إرساله. Use it before save_proposal: save_proposal replaces the whole proposal.",
    input: z.object({ proposalId: id }),
    run: async ({ proposalId }, user) => {
      need(user, "proposal.view");
      const p = found(await getProposal(proposalId), "العرض");
      const totals = computeTotals(p.items, p.discountMinor, p.taxRateBp);
      const amounts = splitPayments(totals.totalMinor, p.milestones.map((m) => m.percentBp));
      const money = (minor: number) => formatMoney(minor, p.currency);
      return {
        ...p,
        statusLabel: PROPOSAL_STATUS_LABEL[p.status],
        totals: { subtotal: money(totals.subtotalMinor), discount: money(totals.discountMinor), tax: money(totals.taxMinor), total: money(totals.totalMinor), totalMinor: totals.totalMinor },
        milestones: p.milestones.map((m, i) => ({ ...m, percent: formatPercentBp(m.percentBp), amount: money(amounts[i] ?? 0) })),
        blockingProblems: blockingProblems(p),
        placeholdersLeft: countPlaceholders(p),
        // The same shape save_proposal takes, ready to edit and send back.
        editable: {
          title: p.title,
          currency: p.currency,
          taxPercent: p.taxRateBp === null ? "" : String(p.taxRateBp / 100),
          discount: p.discountMinor ? toDecimalText(p.discountMinor) : "",
          validUntil: p.validUntil ?? "",
          intro: p.intro,
          items: p.items.map((item) => ({ title: item.title, description: item.description, quantity: item.quantity, price: toDecimalText(item.unitPriceMinor) })),
          milestones: p.milestones.map((m) => ({ title: m.title, percent: String(m.percentBp / 100) })),
          sections: p.sections,
          timeline: p.timeline,
        },
      };
    },
  }),
  tool({
    name: "create_proposal",
    title: "Create a proposal for a deal",
    description: "مسودة عرض جديدة لصفقة، من قالب نوع المشروع. Creates a draft proposal; edit it with save_proposal.",
    write: true,
    input: z.object({ dealId: id }),
    run: async ({ dealId }, user) => {
      const result = await act(user, createProposalAction, { dealId });
      return { created: true, proposalId: idFrom(result.location) };
    },
  }),
  tool({
    name: "save_proposal",
    title: "Save a draft proposal",
    description:
      "حفظ عرض (مسودة فقط) — يستبدل العرض كله: خذ editable من get_proposal وعدّله. Prices/discount are decimal text, taxPercent like \"14\" or \"\" for none, milestone percents must add up to 100.",
    write: true,
    input: z.object({
      proposalId: id,
      title: z.string(),
      currency: z.enum(CURRENCIES),
      taxPercent: z.string().default(""),
      discount: z.string().default(""),
      validUntil: z.string().default(""),
      intro: z.string().default(""),
      items: z.array(z.object({ title: z.string(), description: z.string().default(""), quantity: z.number().int(), price: z.string() })),
      milestones: z.array(z.object({ title: z.string(), percent: z.string() })),
      sections: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
      timeline: z.array(z.object({ title: z.string(), weeks: z.number().int() })).default([]),
    }),
    run: async ({ proposalId, ...payload }, user) => {
      await act(user, saveProposalAction, { id: proposalId, payload: JSON.stringify(payload) });
      return { saved: true };
    },
  }),
  tool({
    name: "mark_proposal_sent",
    title: "Mark a proposal as sent",
    description: "تعليم العرض أنه اتبعت للعميل (يقفله للتعديل وينقل الصفقة لـ«عرض مُرسل»). Fails while blocking problems remain.",
    write: true,
    input: z.object({ proposalId: id }),
    run: async ({ proposalId }, user) => {
      await act(user, markSentAction, { id: proposalId });
      return { sent: true };
    },
  }),
  tool({
    name: "set_proposal_outcome",
    title: "Record the client's answer to a proposal",
    description: "العميل قبل العرض أو رفضه (للعرض المُرسل). accepted updates the deal's value.",
    write: true,
    input: z.object({ proposalId: id, outcome: z.enum(["accepted", "rejected"]) }),
    run: async ({ proposalId, outcome }, user) => {
      await act(user, outcomeAction, { id: proposalId, outcome });
      return { recorded: true, outcome };
    },
  }),
  tool({
    name: "duplicate_proposal",
    title: "Duplicate a proposal",
    description: "نسخة مسودة جديدة برقم جديد من عرض (الطريقة الوحيدة لتعديل عرض اتبعت). New draft copy of a proposal.",
    write: true,
    input: z.object({ proposalId: id }),
    run: async ({ proposalId }, user) => {
      const result = await act(user, duplicateProposalAction, { id: proposalId });
      return { created: true, proposalId: idFrom(result.location) };
    },
  }),

  // ---------- projects ----------
  tool({
    name: "list_projects",
    title: "List projects",
    description: "المشاريع (الموظف يرى المشاريع التي له فيها مهام). Projects with progress.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "project.view_own");
      return listProjects({ memberId: can(user.role, "project.view_all") ? undefined : user.id });
    },
  }),
  tool({
    name: "get_project",
    title: "Get a project",
    description: "مشروع ومهامه. A project with its tasks.",
    input: z.object({ projectId: id }),
    run: async ({ projectId }, user) => {
      need(user, "project.view_own");
      const all = can(user.role, "project.view_all");
      const project = found(await getProject(projectId, all ? undefined : user.id), "المشروع");
      const tasks = await listTasks({ projectId, ...(can(user.role, "task.view_all") ? {} : { assigneeId: user.id }) });
      return { ...project, tasks };
    },
  }),
  tool({
    name: "create_project",
    title: "Create a project",
    description: "مشروع جديد (لعميل أو داخلي). Dates YYYY-MM-DD.",
    write: true,
    input: z.object({ name: z.string(), clientId: id.optional(), managerId: id.optional(), startDate: isoDate, dueDate: isoDate.optional(), notes: z.string().optional() }),
    run: async (args, user) => {
      const result = await act(user, createProjectAction, { name: args.name, clientId: args.clientId ?? "", managerId: args.managerId ?? "", startDate: args.startDate, dueDate: args.dueDate ?? "", notes: args.notes ?? "" });
      return { created: true, projectId: idFrom(result.location) };
    },
  }),
  tool({
    name: "start_project_from_deal",
    title: "Start the project of a won deal",
    description: "يبدأ مشروع من صفقة فازت وعرضها المقبول، ويعمل مهمة لكل مرحلة من الجدول الزمني.",
    write: true,
    input: z.object({ dealId: id, startDate: isoDate.optional() }),
    run: async ({ dealId, startDate }, user) => {
      const result = await act(user, startProjectAction, { dealId, startDate: startDate ?? "" });
      return { started: true, projectId: idFrom(result.location), message: result.message };
    },
  }),
  tool({
    name: "update_project",
    title: "Update a project",
    description: `تعديل مشروع (كل الحقول). status: ${PROJECT_STATUSES.join(", ")}.`,
    write: true,
    input: z.object({ projectId: id, name: z.string(), status: z.enum(PROJECT_STATUSES), clientId: id.optional(), managerId: id.optional(), startDate: isoDate, dueDate: isoDate.optional(), notes: z.string().optional() }),
    run: async (args, user) => {
      await act(user, updateProjectAction, { id: args.projectId, status: args.status, name: args.name, clientId: args.clientId ?? "", managerId: args.managerId ?? "", startDate: args.startDate, dueDate: args.dueDate ?? "", notes: args.notes ?? "" });
      return { updated: true };
    },
  }),

  // ---------- tasks ----------
  tool({
    name: "list_tasks",
    title: "List tasks",
    description: `المهام (الموظف يرى مهامه فقط). statuses: ${TASK_STATUSES.join(", ")}.`,
    input: z.object({ status: z.enum(TASK_STATUSES).optional(), assigneeId: id.optional(), projectId: id.optional() }),
    run: async ({ status, assigneeId, projectId }, user) => {
      need(user, "task.view_own");
      const all = can(user.role, "task.view_all");
      return listTasks({ status, projectId, assigneeId: all ? assigneeId : user.id });
    },
  }),
  tool({
    name: "get_task",
    title: "Get a task",
    description: "مهمة وسجلها (تعليقات وتغييرات). A task with its history.",
    input: z.object({ taskId: id }),
    run: async ({ taskId }, user) => {
      need(user, "task.view_own");
      const task = await getTask(taskId);
      if (!task || !canAccessTask(user, task)) throw new ToolError("المهمة غير موجودة، أو ليست مسندة إليك.");
      return { ...task, events: await listEvents(taskId) };
    },
  }),
  tool({
    name: "create_task",
    title: "Create a task",
    description: `مهمة جديدة. priority: ${PRIORITIES.join(", ")}. dueDate YYYY-MM-DD. Optionally linked to a project, deal or client.`,
    write: true,
    input: z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(PRIORITIES).default("normal"),
      dueDate: isoDate.optional(),
      assigneeId: id.optional(),
      projectId: id.optional(),
      dealId: id.optional(),
      clientId: id.optional(),
    }),
    run: async (args, user) => {
      const result = await act(user, createTaskAction, {
        title: args.title,
        description: args.description ?? "",
        priority: args.priority,
        dueDate: args.dueDate ?? "",
        assigneeId: args.assigneeId ?? "",
        projectId: args.projectId ?? "",
        dealId: args.dealId ?? "",
        clientId: args.clientId ?? "",
      });
      return { created: true, taskId: idFrom(result.location) };
    },
  }),
  tool({
    name: "update_task",
    title: "Update a task",
    description: "تعديل تفاصيل مهمة (كل الحقول؛ اقرأها أولًا بـ get_task).",
    write: true,
    input: z.object({
      taskId: id,
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(PRIORITIES),
      dueDate: isoDate.optional(),
      projectId: id.optional(),
      dealId: id.optional(),
      clientId: id.optional(),
    }),
    run: async (args, user) => {
      await act(user, updateTaskAction, {
        id: args.taskId,
        title: args.title,
        description: args.description ?? "",
        priority: args.priority,
        dueDate: args.dueDate ?? "",
        projectId: args.projectId ?? "",
        dealId: args.dealId ?? "",
        clientId: args.clientId ?? "",
      });
      return { updated: true };
    },
  }),
  tool({
    name: "assign_task",
    title: "Assign a task",
    description: "إسناد مهمة لعضو في الفريق، أو إلغاء الإسناد بدون assigneeId.",
    write: true,
    input: z.object({ taskId: id, assigneeId: id.optional() }),
    run: async ({ taskId, assigneeId }, user) => {
      await act(user, assignTaskAction, { id: taskId, assigneeId: assigneeId ?? "" });
      return { assigned: true };
    },
  }),
  tool({
    name: "change_task_status",
    title: "Change a task's status",
    description: `تغيير حالة مهمة. ${TASK_STATUSES.join(", ")}. blocked needs a reason; done may need review rights.`,
    write: true,
    input: z.object({ taskId: id, status: z.enum(TASK_STATUSES), reason: z.string().optional() }),
    run: async ({ taskId, status, reason }, user) => {
      await act(user, changeTaskStatusAction, { id: taskId, status, reason: reason ?? "" });
      return { changed: true, status };
    },
  }),
  tool({
    name: "add_task_comment",
    title: "Comment on a task",
    description: "تعليق على مهمة. Adds a comment to a task.",
    write: true,
    input: z.object({ taskId: id, body: z.string() }),
    run: async ({ taskId, body }, user) => {
      await act(user, addCommentAction, { id: taskId, body });
      return { added: true };
    },
  }),
];
