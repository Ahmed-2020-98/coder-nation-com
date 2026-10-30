import { Clapperboard } from "lucide-react";
import { FilmingStudio } from "@/components/filming/FilmingStudio";
import { CardPicker } from "@/components/shell/CardPicker";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Status";
import { listCards } from "@/server/db";
import { getFilmingView } from "@/server/services/filming";

export const dynamic = "force-dynamic";

export default async function FilmingPage(props: PageProps<"/filming">) {
  const { card } = await props.searchParams;
  const requested = typeof card === "string" ? card : null;
  const cards = listCards();
  const selected = cards.find((c) => c.id === requested) ?? cards.find((c) => c.stage === "filming") ?? cards[0] ?? null;
  const view = selected ? await getFilmingView(selected.id) : null;

  return (
    <>
      <PageHeader index="04" title="التصوير والمونتاج" description="Shot list من السكريبت، Teleprompter للتصوير، وخطة مونتاج بالـ Timestamps بعد ما ترفع الفيديو." />
      <CardPicker
        label="اختار كارت"
        cards={cards.map(({ id, title, slug, stage }) => ({ id, title, slug, stage }))}
        selectedId={selected?.id ?? null}
        basePath="/filming"
      />
      {view ? (
        <FilmingStudio key={view.card.id} view={view} />
      ) : (
        <EmptyState icon={<Clapperboard aria-hidden="true" className="size-5" />} title="لسه مفيش كروت">
          <p>التصوير بيبدأ بعد ما تعتمد سكريبت.</p>
          <Button href="/research" className="mt-4">روح لـ Research</Button>
        </EmptyState>
      )}
    </>
  );
}
