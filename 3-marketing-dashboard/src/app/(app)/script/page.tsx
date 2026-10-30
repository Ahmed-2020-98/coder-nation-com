import { PenLine } from "lucide-react";
import { CardPicker } from "@/components/shell/CardPicker";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScriptStudio } from "@/components/script/ScriptStudio";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Status";
import { listCards } from "@/server/db";
import { getScriptView } from "@/server/services/script";

export const dynamic = "force-dynamic";

export default async function ScriptPage(props: PageProps<"/script">) {
  const { card } = await props.searchParams;
  const requested = typeof card === "string" ? card : null;
  const cards = listCards();
  // Default to the first card that still needs script work, else the newest one.
  const selected = cards.find((c) => c.id === requested) ?? cards.find((c) => c.stage === "idea" || c.stage === "script") ?? cards[0] ?? null;
  const view = selected ? getScriptView(selected.id) : null;

  return (
    <>
      <PageHeader index="03" title="السكريبت" description="اكتب بالـ Agent، عدّل بإيدك، وشوف المدة لحظيًا. الاعتماد هو اللي بينقل الكارت للتصوير." />
      <CardPicker
        label="اختار كارت"
        cards={cards.map(({ id, title, slug, stage }) => ({ id, title, slug, stage }))}
        selectedId={selected?.id ?? null}
        basePath="/script"
      />
      {view ? (
        <ScriptStudio key={view.card.id} view={view} />
      ) : (
        <EmptyState icon={<PenLine aria-hidden="true" className="size-5" />} title="لسه مفيش كروت">
          <p>السكريبت بيتكتب لفكرة اخترتها من Research.</p>
          <Button href="/research" className="mt-4">روح لـ Research</Button>
        </EmptyState>
      )}
    </>
  );
}
