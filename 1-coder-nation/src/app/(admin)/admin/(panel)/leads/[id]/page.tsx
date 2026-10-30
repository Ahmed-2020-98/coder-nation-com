import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { LeadStatusBadge } from "@/components/admin/LeadStatusBadge";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { formatDateTime, whatsappLinkFor } from "@/lib/lead-contact";
import { getLead } from "@/server/leads";
import { LeadEditor } from "./LeadEditor";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "تفاصيل الطلب" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const whatsapp = whatsappLinkFor(lead.phone);

  return (
    <>
      <Link href="/admin/leads" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-0 ltr:rotate-180" />
        كل الطلبات
      </Link>
      <PageHeader title={lead.name} description={`وصل ${formatDateTime(lead.createdAt)}`} actions={<LeadStatusBadge status={lead.status} />} />

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">بيانات العميل</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">الهاتف</dt>
              <dd dir="ltr" className="mt-0.5 text-start font-mono text-base font-semibold">
                {lead.phone}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">الإيميل</dt>
              <dd dir="ltr" className="mt-0.5 text-start text-base font-semibold break-all">
                {lead.email ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">نوع المشروع</dt>
              <dd className="mt-0.5 text-base font-semibold">{lead.service ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">التفاصيل</dt>
              <dd className="mt-0.5 text-base leading-8 whitespace-pre-wrap">{lead.message ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            {whatsapp ? (
              <Button href={whatsapp} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
                <MessageCircle aria-hidden="true" className="size-4" />
                واتساب
                <span className="sr-only">(يفتح في نافذة جديدة)</span>
              </Button>
            ) : (
              <span className="self-center text-xs text-ink-muted">الرقم من غير كود الدولة، فمفيش رابط واتساب.</span>
            )}
            <Button href={`tel:${lead.phone}`} variant="secondary" size="sm">
              <Phone aria-hidden="true" className="size-4" />
              اتصال
            </Button>
            {lead.email ? (
              <Button href={`mailto:${lead.email}`} variant="secondary" size="sm">
                <Mail aria-hidden="true" className="size-4" />
                إيميل
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">المتابعة</h2>
          <LeadEditor id={lead.id} name={lead.name} status={lead.status} note={lead.note} />
        </Card>
      </div>
    </>
  );
}
