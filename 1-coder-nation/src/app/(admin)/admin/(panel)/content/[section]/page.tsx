import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { computeView, defaultsFor } from "@/lib/content-model";
import { SECTION_SPECS, isSectionId } from "@/lib/content-spec";
import { currentSection, readStored } from "@/server/content";
import { requireAdmin } from "@/server/session";
import { ContentEditor } from "./ContentEditor";

export const metadata: Metadata = { title: "تعديل المحتوى" };

export default async function EditSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const { section } = await params;
  if (!isSectionId(section)) notFound();

  const stored = await readStored();
  const { value, modified } = currentSection(section, stored);
  const switchedOff = stored.hidden.includes(section);
  const emptyHidden = !switchedOff && computeView(stored).hidden.includes(section);
  const spec = SECTION_SPECS[section];

  return (
    <>
      <Link href="/admin/content" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-0 ltr:rotate-180" />
        كل الأقسام
      </Link>
      <PageHeader title={spec.title} description={spec.description} />
      <ContentEditor
        key={section}
        section={section}
        initial={value}
        defaults={defaultsFor(section)}
        modified={modified}
        hidden={switchedOff}
        emptyHidden={emptyHidden}
      />
    </>
  );
}
