"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type FaqItem = { q: string; a: string };

/**
 * Accessible accordion (WAI-ARIA disclosure pattern): each question is a real <button>
 * with aria-expanded / aria-controls, so Tab, Enter and Space work with no extra code.
 * The panel animates with grid-template-rows (0fr -> 1fr) instead of animating height.
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-${i}`;
        return (
          <div key={id}>
            <h3>
              <button
                type="button"
                id={`${id}-button`}
                aria-expanded={isOpen}
                aria-controls={`${id}-panel`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-start text-[1.05rem] font-semibold text-ink transition-colors hover:text-accent sm:px-6"
              >
                <span>{item.q}</span>
                <Plus
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0 text-accent transition-transform duration-(--duration-base) ease-(--ease-out-expo)",
                    isOpen && "rotate-45",
                  )}
                />
              </button>
            </h3>
            <div
              id={`${id}-panel`}
              role="region"
              aria-labelledby={`${id}-button`}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-(--duration-base) ease-(--ease-out-expo)",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-ink-muted sm:px-6">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
