import type { Metadata } from "next";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { LeadStatusBadge } from "@/components/admin/LeadStatusBadge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { inputClass } from "@/components/admin/ui/Field";
import { LEAD_STATUSES, STATUS_LABEL } from "@/lib/lead-rules";
import { formatDateTime } from "@/lib/lead-contact";
import { isLeadStatus, listLeads } from "@/server/leads";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "طلبات العملاء" };

type SearchParams = Promise<{ status?: string; q?: string; page?: string }>;

function href(params: { status?: string; q?: string; page?: number }): string {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin/leads?${text}` : "/admin/leads";
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const raw = await searchParams;
  const status = isLeadStatus(raw.status) ? raw.status : undefined;
  const q = (raw.q ?? "").trim().slice(0, 100);
  const result = await listLeads({ status, q, page: Number(raw.page) || 1 });
  const exportQuery = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="طلبات العملاء"
        description={`${result.total} طلب${status || q ? " (بعد الفلتر)" : ""}`}
        actions={
          // A plain anchor, not next/link: this is a file download, so the router must not prefetch or intercept it.
          <a
            href={`/admin/leads/export${exportQuery ? `?${exportQuery}` : ""}`}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <Download aria-hidden="true" className="size-4" />
            تصدير CSV
          </a>
        }
      />

      <form action="/admin/leads" role="search" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="filter-status" className="mb-1.5 block text-sm font-semibold">
            الحالة
          </label>
          <select id="filter-status" name="status" defaultValue={status ?? ""} className={`${inputClass} w-44 cursor-pointer`}>
            <option value="">الكل</option>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56 flex-1">
          <label htmlFor="filter-q" className="mb-1.5 block text-sm font-semibold">
            بحث (اسم / هاتف / إيميل)
          </label>
          <input id="filter-q" name="q" defaultValue={q} maxLength={100} className={inputClass} />
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          بحث
        </Button>
        {status || q ? (
          <Button href="/admin/leads" variant="ghost">
            مسح الفلتر
          </Button>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          {status || q ? "مفيش طلبات بتطابق الفلتر ده." : "لسه مفيش طلبات."}
        </p>
      ) : (
        <Card className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">طلبات العملاء</caption>
              <thead>
                <tr className="border-b border-line text-start text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">الاسم</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الهاتف</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">نوع المشروع</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((lead) => (
                  <tr key={lead.id} className="hover:bg-canvas-alt">
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-ink underline-offset-4 hover:text-accent hover:underline">
                        {lead.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      <span className="block text-start font-mono">{lead.phone}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead.service ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDateTime(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result.pages > 1 ? (
        <nav aria-label="الصفحات" className="mt-5 flex items-center justify-between gap-3 text-sm">
          {result.page > 1 ? (
            <Button href={href({ status, q, page: result.page - 1 })} variant="secondary" size="sm">
              السابق
            </Button>
          ) : (
            <span />
          )}
          <span className="text-ink-muted">
            صفحة {result.page} من {result.pages}
          </span>
          {result.page < result.pages ? (
            <Button href={href({ status, q, page: result.page + 1 })} variant="secondary" size="sm">
              التالي
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
