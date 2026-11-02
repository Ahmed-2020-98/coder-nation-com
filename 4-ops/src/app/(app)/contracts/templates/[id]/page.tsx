import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { TemplateEditor } from "./TemplateEditor";
import { deleteTemplateAction } from "@/app/actions/contracts";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { getTemplate } from "@/server/contracts";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "قالب عقد" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("contract.manage");
  const template = await getTemplate((await params).id);
  if (!template) notFound();
  return (
    <>
      <Link href="/contracts/templates" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        القوالب
      </Link>
      <PageHeader
        title={template.title}
        description="التعديل هنا بيأثر على العقود الجديدة بس."
        actions={
          <form action={deleteTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="danger" size="sm">
              احذف القالب
            </Button>
          </form>
        }
      />
      <TemplateEditor template={{ id: template.id, title: template.title, jobTitle: template.jobTitle, clauses: template.clauses }} />
    </>
  );
}
