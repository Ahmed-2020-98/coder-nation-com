import "server-only";
import { z } from "zod";
import {
  cancelClientContractAction,
  clientContractBackToDraftAction,
  createClientContractAction,
  markClientContractReadyAction,
  markClientContractSignedAction,
  recordPaymentAction,
  saveClientContractAction,
  saveClientTemplateAction,
  voidInvoiceAction,
} from "@/app/actions/client-contracts";
import { createContractAction, duplicateContractAction, saveContractAction, saveTemplateAction, sendContractAction, withdrawContractAction } from "@/app/actions/contracts";
import { CLIENT_CONTRACT_STATUS_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, clientContractProblems, paymentSummary } from "@/lib/client-contract-rules";
import { CONTRACT_STATUS_LABEL, contractProblems } from "@/lib/contract-rules";
import { CURRENCIES } from "@/lib/crm-rules";
import { formatMoney, toDecimalText } from "@/lib/money";
import { contractFacts, getClientContract, getClientTemplate, listClientContracts, listClientTemplates, proposalsAwaitingContract } from "../client-contracts";
import { getContract, getTemplate, listContracts, listTemplates } from "../contracts";
import { getInvoice, listInvoices, paidThrough } from "../invoices";
import { canAccessContract } from "../permissions";
import { ToolError, act, found, idFrom, need, tool } from "./context";

const id = z.string().regex(/^[0-9a-f-]{36}$/i, "معرّف غير صالح (UUID)");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ بصيغة YYYY-MM-DD");
const clause = z.object({ title: z.string(), body: z.string() });

export const agreementTools = [
  // ---------- employee contracts (owner only) ----------
  tool({
    name: "list_employee_contracts",
    title: "List employee contracts",
    description: "عقود العمل مع الموظفين (المالك يرى الكل؛ غيره يرى عقوده المرسلة له).",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "contract.respond");
      const list = await listContracts(user.role === "owner" ? {} : { userId: user.id });
      return list.map((c) => ({ ...c, statusLabel: CONTRACT_STATUS_LABEL[c.status] }));
    },
  }),
  tool({
    name: "get_employee_contract",
    title: "Get an employee contract",
    description: "عقد عمل كامل، وما يمنع إرساله، وصيغة editable جاهزة لـ save_employee_contract.",
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => {
      need(user, "contract.respond");
      const c = await getContract(contractId);
      if (!c || !canAccessContract(user, c)) throw new ToolError("العقد غير موجود.");
      return {
        ...c,
        statusLabel: CONTRACT_STATUS_LABEL[c.status],
        problems: contractProblems(c),
        editable: {
          title: c.title,
          employeeName: c.employeeName,
          jobTitle: c.jobTitle,
          phone: c.phone,
          email: c.email,
          nationalId: c.nationalId,
          address: c.address,
          startDate: c.startDate ?? "",
          workStart: c.workStart,
          workEnd: c.workEnd,
          workDays: c.workDays,
          salary: c.salaryMinor === null ? "" : toDecimalText(c.salaryMinor),
          currency: c.currency,
          commission: c.commission,
          clauses: c.clauses,
        },
      };
    },
  }),
  tool({
    name: "create_employee_contract",
    title: "Create an employee contract",
    description: "مسودة عقد عمل لعضو في الفريق من قالب (templateId اختياري). See list_contract_templates.",
    write: true,
    input: z.object({ userId: id, templateId: id.optional() }),
    run: async ({ userId, templateId }, user) => {
      const result = await act(user, createContractAction, { userId, templateId: templateId ?? "" });
      return { created: true, contractId: idFrom(result.location) };
    },
  }),
  tool({
    name: "save_employee_contract",
    title: "Save an employee contract (draft)",
    description: "حفظ مسودة عقد عمل (يستبدل كل الحقول؛ خذ editable من get_employee_contract). Times HH:MM, workDays 0=Sunday..6, salary decimal text.",
    write: true,
    input: z.object({
      contractId: id,
      title: z.string(),
      employeeName: z.string(),
      jobTitle: z.string().default(""),
      phone: z.string().default(""),
      email: z.string().default(""),
      nationalId: z.string().default(""),
      address: z.string().default(""),
      startDate: z.string().default(""),
      workStart: z.string(),
      workEnd: z.string(),
      workDays: z.array(z.number().int().min(0).max(6)),
      salary: z.string().default(""),
      currency: z.enum(CURRENCIES).default("EGP"),
      commission: z.string().default(""),
      clauses: z.array(clause),
    }),
    run: async ({ contractId, ...payload }, user) => {
      await act(user, saveContractAction, { id: contractId, payload: JSON.stringify(payload) });
      return { saved: true };
    },
  }),
  tool({
    name: "send_employee_contract",
    title: "Send an employee contract",
    description: "إرسال عقد العمل للموظف ليوافق عليه من حسابه (يقفله للتعديل).",
    write: true,
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => act(user, sendContractAction, { id: contractId }),
  }),
  tool({
    name: "withdraw_employee_contract",
    title: "Withdraw an employee contract",
    description: "سحب عقد مُرسل (قبل رد الموظف) ليرجع مسودة.",
    write: true,
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => act(user, withdrawContractAction, { id: contractId }),
  }),
  tool({
    name: "duplicate_employee_contract",
    title: "Duplicate an employee contract",
    description: "نسخة مسودة جديدة برقم جديد من عقد عمل (لتعديل عقد اتبعت أو اترد عليه).",
    write: true,
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => {
      const result = await act(user, duplicateContractAction, { id: contractId });
      return { created: true, contractId: idFrom(result.location) };
    },
  }),
  tool({
    name: "list_contract_templates",
    title: "Employee contract templates",
    description: "قوالب عقود العمل (لكل وظيفة بنودها).",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "contract.manage");
      return listTemplates();
    },
  }),
  tool({
    name: "save_contract_template",
    title: "Save an employee contract template",
    description: "تعديل قالب عقد عمل (العنوان، المسمى، البنود). Tokens like {المرتب} are filled from each contract.",
    write: true,
    input: z.object({ templateId: id, title: z.string(), jobTitle: z.string(), clauses: z.array(clause) }),
    run: async ({ templateId, ...payload }, user) => {
      need(user, "contract.manage");
      found(await getTemplate(templateId), "القالب");
      await act(user, saveTemplateAction, { id: templateId, payload: JSON.stringify(payload) });
      return { saved: true };
    },
  }),

  // ---------- client contracts ----------
  tool({
    name: "list_client_contracts",
    title: "List client contracts",
    description: "عقود العملاء مع المدفوع من كل عقد، والعروض المقبولة اللي لسه مالهاش عقد.",
    input: z.object({ dealId: id.optional() }),
    run: async ({ dealId }, user) => {
      need(user, "client_contract.manage");
      const [contracts, waiting] = await Promise.all([listClientContracts({ dealId }), dealId ? Promise.resolve([]) : proposalsAwaitingContract()]);
      return {
        contracts: contracts.map((c) => ({ ...c, statusLabel: CLIENT_CONTRACT_STATUS_LABEL[c.status], total: formatMoney(c.totalMinor, c.currency), paid: formatMoney(c.paidMinor, c.currency) })),
        acceptedProposalsWithoutContract: waiting,
      };
    },
  }),
  tool({
    name: "get_client_contract",
    title: "Get a client contract",
    description: "عقد عميل كامل: الأطراف، النطاق، الدفعات وما اتحصّل منها، الفواتير، وما يمنع أنه يبقى جاهز للتوقيع.",
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => {
      need(user, "client_contract.manage");
      const c = found(await getClientContract(contractId), "العقد");
      const invoices = await listInvoices({ contractId });
      const { paidMinor, remainingMinor } = paymentSummary(c.totalMinor, invoices);
      const money = (minor: number) => formatMoney(minor, c.currency);
      return {
        ...c,
        statusLabel: CLIENT_CONTRACT_STATUS_LABEL[c.status],
        total: money(c.totalMinor),
        paid: money(paidMinor),
        remaining: money(remainingMinor),
        problems: c.status === "draft" ? clientContractProblems(await contractFacts(c)) : [],
        invoices: invoices.map((i) => ({ id: i.id, number: i.number, amount: money(i.amountMinor), paidOn: i.paidOn, method: PAYMENT_METHOD_LABEL[i.method], status: i.status })),
      };
    },
  }),
  tool({
    name: "create_client_contract",
    title: "Create a client contract from an accepted proposal",
    description: "عقد عميل من عرض مقبول (ياخد الأسعار والدفعات والنطاق من العرض). templateId اختياري.",
    write: true,
    input: z.object({ proposalId: id, templateId: id.optional() }),
    run: async ({ proposalId, templateId }, user) => {
      const result = await act(user, createClientContractAction, { proposalId, templateId: templateId ?? "" });
      return { created: true, contractId: idFrom(result.location) };
    },
  }),
  tool({
    name: "save_client_contract",
    title: "Save a client contract (draft)",
    description: "حفظ مسودة عقد عميل: بيانات العميل وتاريخ البدء والبنود (يستبدل الكل). املأ أي فراغ [..] في البنود.",
    write: true,
    input: z.object({
      contractId: id,
      title: z.string(),
      clientName: z.string(),
      clientRepresentative: z.string().default(""),
      clientIdNumber: z.string().default(""),
      clientAddress: z.string().default(""),
      clientPhone: z.string().default(""),
      clientEmail: z.string().default(""),
      startDate: z.string().default(""),
      clauses: z.array(clause),
    }),
    run: async ({ contractId, ...payload }, user) => {
      await act(user, saveClientContractAction, { id: contractId, payload: JSON.stringify(payload) });
      return { saved: true };
    },
  }),
  tool({
    name: "mark_client_contract_ready",
    title: "Mark a client contract ready to sign",
    description: "يقفل العقد للطباعة والتوقيع (لازم مايبقاش فيه مشاكل). Payments can be recorded from then on.",
    write: true,
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => act(user, markClientContractReadyAction, { id: contractId }),
  }),
  tool({
    name: "client_contract_back_to_draft",
    title: "Return a client contract to draft",
    description: "يرجّع عقد «جاهز للتوقيع» مسودة للتعديل (لو مفيش دفعات عليه).",
    write: true,
    input: z.object({ contractId: id }),
    run: async ({ contractId }, user) => act(user, clientContractBackToDraftAction, { id: contractId }),
  }),
  tool({
    name: "mark_client_contract_signed",
    title: "Record that the client signed",
    description: "تسجيل توقيع العميل على النسخة الورقية: التاريخ (YYYY-MM-DD) واسم اللي وقّع.",
    write: true,
    input: z.object({ contractId: id, signedOn: isoDate, signedByName: z.string() }),
    run: async ({ contractId, signedOn, signedByName }, user) => act(user, markClientContractSignedAction, { id: contractId, signedOn, signedByName }),
  }),
  tool({
    name: "cancel_client_contract",
    title: "Cancel a client contract",
    description: "إلغاء عقد عميل بسبب (لازم تكون فواتيره ملغاة الأول).",
    write: true,
    destructive: true,
    input: z.object({ contractId: id, reason: z.string() }),
    run: async ({ contractId, reason }, user) => act(user, cancelClientContractAction, { id: contractId, reason }),
  }),
  tool({
    name: "list_client_contract_templates",
    title: "Client contract templates",
    description: "قوالب البنود القانونية لعقود العملاء.",
    input: z.object({}),
    run: async (_args, user) => {
      need(user, "client_contract.manage");
      return listClientTemplates();
    },
  }),
  tool({
    name: "save_client_contract_template",
    title: "Save a client contract template",
    description: "تعديل قالب عقد عميل (العنوان والبنود). Tokens like {إجمالي_العقد} are filled from each contract.",
    write: true,
    input: z.object({ templateId: id, title: z.string(), clauses: z.array(clause) }),
    run: async ({ templateId, ...payload }, user) => {
      need(user, "client_contract.manage");
      found(await getClientTemplate(templateId), "القالب");
      await act(user, saveClientTemplateAction, { id: templateId, payload: JSON.stringify(payload) });
      return { saved: true };
    },
  }),

  // ---------- payments and invoices ----------
  tool({
    name: "list_invoices",
    title: "List invoices",
    description: "الفواتير (دفعات العملاء): الكل، أو لعقد، أو بين تاريخين للدفع (YYYY-MM-DD).",
    input: z.object({ contractId: id.optional(), from: isoDate.optional(), to: isoDate.optional() }),
    run: async ({ contractId, from, to }, user) => {
      need(user, "invoice.issue");
      const list = await listInvoices({ contractId, from, to });
      return list.map((i) => ({ ...i, amount: formatMoney(i.amountMinor, i.currency), methodLabel: PAYMENT_METHOD_LABEL[i.method] }));
    },
  }),
  tool({
    name: "get_invoice",
    title: "Get an invoice",
    description: "فاتورة، ومعاها إجمالي العقد والمدفوع لحد تاريخها والمتبقي.",
    input: z.object({ invoiceId: id }),
    run: async ({ invoiceId }, user) => {
      need(user, "invoice.issue");
      const invoice = found(await getInvoice(invoiceId), "الفاتورة");
      const [contract, paid] = await Promise.all([getClientContract(invoice.contractId), paidThrough(invoice.id)]);
      const money = (minor: number) => formatMoney(minor, invoice.currency);
      return { ...invoice, amount: money(invoice.amountMinor), contractTotal: contract ? money(contract.totalMinor) : null, paidToDate: money(paid), remaining: contract ? money(Math.max(0, contract.totalMinor - paid)) : null };
    },
  }),
  tool({
    name: "record_payment",
    title: "Record a client payment (issues an invoice)",
    description: `تسجيل مبلغ وصل من العميل على عقد (جاهز أو موقّع) ويطلّع فاتورة. amount decimal text, paidOn YYYY-MM-DD (not in the future), methods: ${PAYMENT_METHODS.join(", ")}. milestoneIndex: 0-based payment of the schedule, optional.`,
    write: true,
    input: z.object({
      contractId: id,
      amount: z.string(),
      paidOn: isoDate,
      method: z.enum(PAYMENT_METHODS),
      milestoneIndex: z.number().int().min(0).optional(),
      reference: z.string().default(""),
      note: z.string().default(""),
    }),
    run: async (args, user) => {
      const result = await act(user, recordPaymentAction, {
        contractId: args.contractId,
        amount: args.amount,
        paidOn: args.paidOn,
        method: args.method,
        milestoneIndex: args.milestoneIndex ?? "",
        reference: args.reference,
        note: args.note,
      });
      const invoiceId = idFrom(result.location);
      const invoice = invoiceId ? await getInvoice(invoiceId) : null;
      return { recorded: true, invoiceId, invoiceNumber: invoice?.number ?? null };
    },
  }),
  tool({
    name: "void_invoice",
    title: "Void an invoice",
    description: "إلغاء فاتورة سُجّلت بالغلط (للمالك فقط، بسبب). الرقم بيفضل محجوز والمبلغ بيخرج من المدفوع.",
    write: true,
    destructive: true,
    input: z.object({ invoiceId: id, reason: z.string() }),
    run: async ({ invoiceId, reason }, user) => {
      need(user, "invoice.void");
      return act(user, voidInvoiceAction, { id: invoiceId, reason });
    },
  }),
];
