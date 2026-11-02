import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { createClientTemplateAction } from "@/app/actions/client-contracts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import { listClientTemplates } from "@/server/client-contracts";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "قوالب عقود العملاء" };

export default async function ClientTemplatesPage() {
  await requirePermission("client_contract.manage");
  const templates = await listClientTemplates();
  return (
    <>
      <Link href="/client-contracts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        عقود العملاء
      </Link>
      <PageHeader
        title="قوالب عقود العملاء"
        description="البنود القانونية للعقد. العقد الجديد بياخد نسخة من بنود القالب، وتعديل القالب بعد كده مش بيغيّر العقود القديمة. الأول في القائمة هو الافتراضي."
        actions={
          <form action={createClientTemplateAction}>
            <Button type="submit">
              <Plus aria-hidden="true" className="size-4" />
              قالب جديد
            </Button>
          </form>
        }
      />
      {templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">لسه مفيش قوالب.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/client-contracts/templates/${t.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                    {t.title}
                  </Link>
                  <p className="text-sm text-ink-muted">{t.clauses.length} بند</p>
                </div>
                <span className="text-sm text-ink-muted">آخر تعديل {formatDate(t.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
