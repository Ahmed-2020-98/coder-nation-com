import Link from "next/link";
import { cn } from "@/lib/cn";
import { STAGE_LABEL, type Stage } from "@/lib/stages";

type PickerCard = { id: string; title: string; slug: string; stage: Stage };

type Props = {
  cards: PickerCard[];
  selectedId: string | null;
  basePath: string;
  label: string;
};

/** Which video are we working on? A row of chips (slug + stage); the choice lives in the URL (?card=). */
export function CardPicker({ cards, selectedId, basePath, label }: Props) {
  if (cards.length === 0) return null;
  return (
    <nav aria-label={label} className="mb-6">
      <ul className="thin-scroll flex gap-2 overflow-x-auto pb-1">
        {cards.map((card) => {
          const active = card.id === selectedId;
          return (
            <li key={card.id} className="shrink-0">
              <Link
                href={`${basePath}?card=${card.id}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-12 flex-col justify-center rounded-lg border px-3.5 py-1.5 text-start transition-colors",
                  active ? "border-primary-500 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="max-w-56 truncate text-sm leading-5 font-semibold">{card.title}</span>
                <span className="flex items-center gap-2 text-xs leading-4 text-ink-muted">
                  <span dir="ltr" className="font-mono">{card.slug}</span>
                  <span aria-hidden="true">•</span>
                  {STAGE_LABEL[card.stage]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
