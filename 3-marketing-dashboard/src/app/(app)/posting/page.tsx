import { CalendarClock } from "lucide-react";
import { PostingStudio } from "@/components/posting/PostingStudio";
import { CardPicker } from "@/components/shell/CardPicker";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Status";
import { listCards } from "@/server/db";
import { parseMontage } from "@/server/parse/montage";
import { getCalendar, getPostingView } from "@/server/services/posting";
import { outputExists, readOutput } from "@/server/services/common";

export const dynamic = "force-dynamic";

export default async function PostingPage(props: PageProps<"/posting">) {
  const { card } = await props.searchParams;
  const requested = typeof card === "string" ? card : null;
  const cards = listCards();
  const selected =
    cards.find((c) => c.id === requested) ??
    cards.find((c) => c.stage === "filming" && c.montageFile) ??
    cards.find((c) => c.stage === "ready") ??
    cards[0] ??
    null;
  const view = selected ? getPostingView(selected.id) : null;
  const montageApproved = Boolean(
    selected?.montageFile && outputExists(selected.montageFile, "montage") && parseMontage(readOutput(selected.montageFile, "montage")).header.status === "approved",
  );

  return (
    <>
      <PageHeader index="05" title="النشر" description="كابشن وهاشتاجات ووقت مقترح، وكلها قابلة للتعديل. التقويم لتنظيم المواعيد، والنشر الفعلي بيتم بإيدك." />
      <CardPicker
        label="اختار كارت"
        cards={cards.map(({ id, title, slug, stage }) => ({ id, title, slug, stage }))}
        selectedId={selected?.id ?? null}
        basePath="/posting"
      />
      {view ? (
        <PostingStudio key={view.card.id} view={view} montageApproved={montageApproved} calendar={getCalendar()} />
      ) : (
        <EmptyState icon={<CalendarClock aria-hidden="true" className="size-5" />} title="لسه مفيش كروت">
          <p>النشر بيبدأ بعد اعتماد السكريبت وخطة المونتاج.</p>
          <Button href="/research" className="mt-4">روح لـ Research</Button>
        </EmptyState>
      )}
    </>
  );
}
