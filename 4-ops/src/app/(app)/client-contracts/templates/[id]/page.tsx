import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ClientTemplateEditor } from "./ClientTemplateEditor";
import { deleteClientTemplateAction } from "@/app/actions/client-contracts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { getClientTemplate } from "@/server/client-contracts";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "قالب عقد عميل" };

export default async function ClientTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client_contract.manage");
  const template = await getClientTemplate((await params).id);
  if (!template) notFound();
  return (
    <>
      <Link href="/client-contracts/templates" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        القوالب
      </Link>
      <PageHeader
        title={template.title}
        description="التعديل هنا بيأثر على العقود الجديدة بس. كمّل الفراغات بين [ ] مرة واحدة هنا، فكل عقد جديد يطلع جاهز."
        actions={
          <form action={deleteClientTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="danger" size="sm">
              احذف القالب
            </Button>
          </form>
        }
      />
      <ClientTemplateEditor template={{ id: template.id, title: template.title, clauses: template.clauses }} />
    </>
  );
}
