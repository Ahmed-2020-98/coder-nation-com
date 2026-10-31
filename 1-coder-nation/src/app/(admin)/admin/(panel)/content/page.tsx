import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { computeView, parseStoredSection } from "@/lib/content-model";
import { SECTION_IDS, SECTION_SPECS, type SectionId } from "@/lib/content-spec";
import { readStored } from "@/server/content";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "محتوى الموقع" };

/** "الخدمات: 4" for the sections that are a list of things, nothing for the rest. */
function summary(id: SectionId, content: ReturnType<typeof computeView>["content"]): string | null {
  switch (id) {
    case "services":
      return `الخدمات: ${content.services.items.length}`;
    case "why":
      return `الأسباب: ${content.why.reasons.length}`;
    case "process":
      return `المراحل: ${content.process.steps.length}`;
    case "work":
      return `المشاريع: ${content.work.items.length}`;
    case "testimonials":
      return `الآراء: ${content.testimonials.items.length}`;
    case "faq":
      return `الأسئلة: ${content.faq.items.length}`;
    default:
      return null;
  }
}

export default async function ContentPage() {
  await requireAdmin();
  const stored = await readStored();
  const view = computeView(stored);

  return (
    <>
      <PageHeader
        title="محتوى الموقع"
        description="عدّل نصوص الصفحة الرئيسية وأضف أعمالك وآراء عملائك وأسئلتك. كل حفظ بيظهر على الموقع فورًا، ولو غلطت تقدر ترجّع أي قسم للنص الأصلي."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {SECTION_IDS.map((id) => {
          const spec = SECTION_SPECS[id];
          const saved = stored.sections[id] !== undefined && parseStoredSection(id, stored.sections[id]) !== null;
          const off = stored.hidden.includes(id);
          const empty = view.hidden.includes(id) && !off;
          const count = summary(id, view.content);
          return (
            <li key={id}>
              <Link href={`/admin/content/${id}`} className="block h-full rounded-xl">
                <Card interactive className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold">{spec.title}</h2>
                    <ChevronLeft aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink-muted rtl:rotate-0 ltr:rotate-180" />
                  </div>
                  <p className="mt-1.5 text-sm text-ink-muted">{spec.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <Badge tone={saved ? "accent" : "neutral"}>{saved ? "معدّل" : "النص الافتراضي"}</Badge>
                    {off ? <Badge tone="error">مخفي من الموقع</Badge> : null}
                    {empty ? <Badge tone="error">مخفي لأنه فاضي</Badge> : null}
                    {count ? <span className="text-xs text-ink-muted">{count}</span> : null}
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-ink-muted">
        رقم الواتساب والإيميل وساعات العمل والسوشيال وعنوان الـ SEO ليهم مكان تاني:{" "}
        <Link href="/admin/settings" className="font-semibold text-accent underline underline-offset-4">
          إعدادات الموقع
        </Link>
        .
      </p>
    </>
  );
}
