import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, FileCheck2, FilePlus2, FileText, FolderKanban } from "lucide-react";
import { completeFollowUpAction } from "@/app/actions/crm";
import { createProposalAction } from "@/app/actions/proposals";
import { PageHeader } from "@/components/PageHeader";
import { ClientContractBadge, ProposalBadge, StageBadge } from "@/components/badges";
import { todayInCairo } from "@/lib/dates";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ACTIVITY_LABEL, SOURCE_LABEL } from "@/lib/crm-rules";
import { formatDateTime, whatsappLinkFor } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listClientContracts } from "@/server/client-contracts";
import { getDeal, listActivities, listFollowUps } from "@/server/crm";
import { canAccessDeal, can } from "@/server/permissions";
import { projectOfDeal } from "@/server/projects";
import { listProposals } from "@/server/proposals";
import { requireUser } from "@/server/session";
import { listAssignableUsers } from "@/server/users";
import { StartProjectForm } from "../../../projects/ProjectForms";
import { ActivityForm, AssignForm, DealEditForm, FollowUpForm, MoveForm } from "./DealForms";

export const metadata: Metadata = { title: "تفاصيل الصفقة" };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const deal = await getDeal(id);
  // An employee asking for someone else's deal gets the same "not found" as for a deal that doesn't exist.
  if (!deal || !canAccessDeal(user, deal)) notFound();

  const manage = can(user.role, "deal.edit");
  const [activities, followUps, users, proposals, projects, contracts] = await Promise.all([
    listActivities(id),
    listFollowUps({ dealId: id }),
    manage ? listAssignableUsers() : Promise.resolve([]),
    can(user.role, "proposal.view") ? listProposals(id) : Promise.resolve([]),
    can(user.role, "project.manage") ? projectOfDeal(id) : Promise.resolve([]),
    can(user.role, "client_contract.manage") ? listClientContracts({ dealId: id }) : Promise.resolve([]),
  ]);
  const phone = deal.contactPhone ?? deal.clientPhone;
  const whatsapp = whatsappLinkFor(phone);

  return (
    <>
      <Link href="/crm" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        كل الصفقات
      </Link>
      <PageHeader
        title={deal.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/crm/clients/${deal.clientId}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
              {deal.clientName}
            </Link>
            <StageBadge stage={deal.stage} />
            <Badge>{SOURCE_LABEL[deal.source]}</Badge>
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">بيانات الصفقة</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">الهاتف</dt>
                <dd dir="ltr" className="mt-0.5 text-start font-mono text-base font-semibold">
                  {phone ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">الإيميل</dt>
                <dd dir="ltr" className="mt-0.5 text-start text-base font-semibold break-all">
                  {deal.contactEmail ?? deal.clientEmail ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">نوع المشروع</dt>
                <dd className="mt-0.5 text-base font-semibold">{deal.service ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">القيمة المتوقعة</dt>
                <dd className="mt-0.5 text-base font-semibold">{deal.valueMinor !== null && deal.currency ? formatMoney(deal.valueMinor, deal.currency) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">المسؤول</dt>
                <dd className="mt-0.5 text-base font-semibold">{deal.ownerName ?? "—"}</dd>
              </div>
              {deal.lostReason ? (
                <div>
                  <dt className="text-ink-muted">سبب الخسارة</dt>
                  <dd className="mt-0.5 text-base font-semibold text-error-700">{deal.lostReason}</dd>
                </div>
              ) : null}
              {deal.message ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">رسالة العميل</dt>
                  <dd className="mt-0.5 leading-8 whitespace-pre-wrap">{deal.message}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-sm font-semibold">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg border border-line-strong px-3.5 hover:border-accent hover:text-accent">
                  واتساب<span className="sr-only">(يفتح في نافذة جديدة)</span>
                </a>
              ) : null}
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex h-10 items-center rounded-lg border border-line-strong px-3.5 hover:border-accent hover:text-accent">
                  اتصال
                </a>
              ) : null}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">سجل النشاط</h2>
            <ActivityForm id={id} />
            <ol className="mt-6 grid gap-4 border-t border-line pt-5">
              {activities.length === 0 ? <li className="text-sm text-ink-muted">مفيش نشاط لسه.</li> : null}
              {activities.map((activity) => (
                <li key={activity.id} className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-ink-muted">
                    <Badge tone={activity.kind === "system" || activity.kind === "stage" ? "neutral" : "accent"}>{ACTIVITY_LABEL[activity.kind]}</Badge>
                    {activity.userName ?? "النظام"} · {formatDateTime(activity.createdAt)}
                  </p>
                  <p className="mt-1.5 leading-7 whitespace-pre-wrap">{activity.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="grid gap-6">
          {can(user.role, "deal.move") ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">المرحلة</h2>
              <MoveForm id={id} stage={deal.stage} />
              {can(user.role, "deal.assign") ? (
                <div className="mt-5 border-t border-line pt-5">
                  <AssignForm id={id} ownerId={deal.ownerId} users={users} />
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">المتابعات</h2>
            <FollowUpForm id={id} />
            <ul className="mt-5 grid gap-3 border-t border-line pt-4">
              {followUps.length === 0 ? <li className="text-sm text-ink-muted">مفيش متابعات.</li> : null}
              {followUps.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className={item.doneAt ? "text-ink-muted line-through" : "font-semibold"}>{formatDateTime(item.dueAt)}</p>
                    {item.note ? <p className="text-ink-muted">{item.note}</p> : null}
                  </div>
                  {item.doneAt ? (
                    <Badge tone="success">تمت</Badge>
                  ) : (
                    <form action={completeFollowUpAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3 font-semibold hover:border-accent hover:text-accent">
                        <Check aria-hidden="true" className="size-4" />
                        تمت
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {can(user.role, "proposal.view") ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">العروض</h2>
              <ul className="grid gap-2.5 text-sm">
                {proposals.length === 0 ? <li className="text-ink-muted">مفيش عروض لسه.</li> : null}
                {proposals.map((proposal) => (
                  <li key={proposal.id} className="flex items-center justify-between gap-3">
                    <Link href={`/proposals/${proposal.id}`} className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:text-accent hover:underline">
                      <FileText aria-hidden="true" className="size-4" />
                      <span dir="ltr">{proposal.number}</span>
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className="text-ink-muted">{formatMoney(proposal.totalMinor, proposal.currency)}</span>
                      <ProposalBadge status={proposal.status} />
                    </span>
                  </li>
                ))}
              </ul>
              {can(user.role, "proposal.edit") ? (
                <form action={createProposalAction} className="mt-4 border-t border-line pt-4">
                  <input type="hidden" name="dealId" value={id} />
                  <button type="submit" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-on-primary hover:bg-primary-400">
                    <FilePlus2 aria-hidden="true" className="size-4" />
                    عرض جديد لهذه الصفقة
                  </button>
                </form>
              ) : null}
            </Card>
          ) : null}

          {contracts.length > 0 ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">العقد والدفعات</h2>
              <ul className="grid gap-2.5 text-sm">
                {contracts.map((c) => (
                  <li key={c.id} className="grid gap-1">
                    <span className="flex items-center justify-between gap-3">
                      <Link href={`/client-contracts/${c.id}`} className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:text-accent hover:underline">
                        <FileCheck2 aria-hidden="true" className="size-4" />
                        <span dir="ltr">{c.number}</span>
                      </Link>
                      <ClientContractBadge status={c.status} />
                    </span>
                    <span className="text-ink-muted">
                      مدفوع {formatMoney(c.paidMinor, c.currency)} من {formatMoney(c.totalMinor, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {deal.stage === "won" && can(user.role, "project.manage") ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">المشروع</h2>
              {projects.length > 0 ? (
                <ul className="grid gap-2.5 text-sm">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-2 font-semibold underline-offset-4 hover:text-accent hover:underline">
                        <FolderKanban aria-hidden="true" className="size-4" />
                        {project.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <p className="mb-4 text-sm text-ink-muted">الصفقة فازت. ابدأ المشروع وهنعمل مهمة لكل مرحلة في الجدول الزمني للعرض.</p>
                  <StartProjectForm dealId={id} today={todayInCairo()} />
                </>
              )}
            </Card>
          ) : null}

          {manage ? (
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-bold">تعديل البيانات</h2>
              <DealEditForm deal={deal} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
