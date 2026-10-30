import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ClientForm, ContactForm } from "../ClientForms";
import { PageHeader } from "@/components/PageHeader";
import { StageBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import { dealsOfClient, getClient } from "@/server/crm";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "العميل" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client.manage");
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const deals = await dealsOfClient(id);

  return (
    <>
      <Link href="/crm/clients" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        كل العملاء
      </Link>
      <PageHeader title={client.name} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">بيانات العميل</h2>
            <ClientForm client={client} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">جهات الاتصال</h2>
            <ul className="mb-5 grid gap-3 text-sm">
              {client.contacts.length === 0 ? <li className="text-ink-muted">مفيش جهات اتصال.</li> : null}
              {client.contacts.map((contact) => (
                <li key={contact.id}>
                  <p className="font-semibold">
                    {contact.name}
                    {contact.jobTitle ? <span className="font-normal text-ink-muted"> · {contact.jobTitle}</span> : null}
                  </p>
                  <p dir="ltr" className="text-start text-ink-muted">
                    {[contact.phone, contact.email].filter(Boolean).join("  ·  ") || "—"}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-line pt-5">
              <ContactForm clientId={id} />
            </div>
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">الصفقات</h2>
          <ul className="grid gap-3 text-sm">
            {deals.length === 0 ? <li className="text-ink-muted">مفيش صفقات.</li> : null}
            {deals.map((deal) => (
              <li key={deal.id} className="flex items-center justify-between gap-3">
                <Link href={`/crm/deals/${deal.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                  {deal.title}
                </Link>
                <span className="flex items-center gap-2">
                  {deal.valueMinor !== null && deal.currency ? <span className="text-ink-muted">{formatMoney(deal.valueMinor, deal.currency)}</span> : null}
                  <StageBadge stage={deal.stage} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
