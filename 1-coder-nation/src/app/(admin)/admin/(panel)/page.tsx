import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { LeadStatusBadge } from "@/components/admin/LeadStatusBadge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/admin/ui/Card";
import { formatDateTime } from "@/lib/lead-contact";
import { leadStats, listLeads } from "@/server/leads";
import { isPlaceholderWhatsapp, readSettings } from "@/server/settings";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "نظرة عامة" };

export default async function OverviewPage() {
  await requireAdmin();
  const [stats, latest, settings] = await Promise.all([leadStats(), listLeads({ page: 1 }), readSettings()]);
  const warnings = [
    isPlaceholderWhatsapp(settings.whatsappNumber) && "رقم الواتساب لسه الرقم المؤقت: العملاء اللي بيدوسوا على زرار واتساب هيروحوا لرقم غلط.",
  ].filter((message): message is string => Boolean(message));

  return (
    <>
      <PageHeader title="نظرة عامة" description="آخر نشاط على الموقع." />

      {warnings.map((message) => (
        <p key={message} role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-error-700" />
          <span>
            {message}{" "}
            <Link href="/admin/settings" className="font-semibold text-accent underline underline-offset-4">
              عدّل الإعدادات
            </Link>
          </span>
        </p>
      ))}

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "طلبات جديدة", value: stats.fresh, href: "/admin/leads?status=new" },
          { label: "آخر 7 أيام", value: stats.week, href: "/admin/leads" },
          { label: "إجمالي الطلبات", value: stats.total, href: "/admin/leads" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="block rounded-xl">
            <Card interactive className="p-5">
              <dt className="text-sm text-ink-muted">{item.label}</dt>
              <dd dir="ltr" className="mt-1 text-start font-mono text-3xl font-bold">
                {item.value}
              </dd>
            </Card>
          </Link>
        ))}
      </dl>

      <section aria-labelledby="latest-title" className="mt-9">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="latest-title" className="text-lg font-bold">
            آخر الطلبات
          </h2>
          <Link href="/admin/leads" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
            كل الطلبات
          </Link>
        </div>
        {latest.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-muted">
            لسه مفيش طلبات. أول طلب هيظهر هنا أول ما حد يبعت الفورم من الموقع.
          </p>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {latest.rows.slice(0, 5).map((lead) => (
                <li key={lead.id}>
                  <Link href={`/admin/leads/${lead.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-canvas-alt">
                    <span className="font-semibold">{lead.name}</span>
                    <span className="flex items-center gap-3 text-sm text-ink-muted">
                      {formatDateTime(lead.createdAt)}
                      <LeadStatusBadge status={lead.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
