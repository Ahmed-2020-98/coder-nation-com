import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ClientForm } from "./ClientForms";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import { listClients } from "@/server/crm";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "العملاء" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("client.manage");
  const { q } = await searchParams;
  const clients = await listClients(q);
  return (
    <>
      <PageHeader title="العملاء" description={`${clients.length} عميل${q ? " (بعد البحث)" : ""}`} />
      <form role="search" action="/crm/clients" className="mb-5 flex max-w-xl items-end gap-3">
        <div className="flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">
            بحث (اسم / هاتف / إيميل)
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          بحث
        </Button>
      </form>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        {clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">{q ? "مفيش عملاء بيطابقوا البحث." : "لسه مفيش عملاء."}</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <caption className="sr-only">العملاء</caption>
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th scope="col" className="px-4 py-3 text-start font-medium">الاسم</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">الهاتف</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">الصفقات</th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">أُضيف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-canvas-alt">
                      <td className="px-4 py-3">
                        <Link href={`/crm/clients/${client.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                          {client.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        <span className="block text-start font-mono">{client.phone ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono">{client.dealCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(client.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">عميل جديد</h2>
          <ClientForm />
        </Card>
      </div>
    </>
  );
}
