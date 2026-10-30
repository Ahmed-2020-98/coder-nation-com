"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/Field";

/** Chips + an input: Enter or comma adds, Backspace on an empty input removes the last one. */
export function TagInput({ value, onChange, label, hint }: { value: string[]; onChange: (next: string[]) => void; label: string; hint?: string }) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const items = raw
      .split(/[,،\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    onChange([...new Set([...value, ...items])]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className={cn(inputClass, "flex h-auto min-h-11 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent")}>
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-accent-soft py-0.5 ps-2.5 pe-1 text-sm text-accent">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`حذف ${tag}`} className="grid size-6 place-items-center rounded hover:bg-primary-500/20">
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : "اكتب كلمة واضغط Enter"}
          className="min-w-32 flex-1 bg-transparent py-1 outline-none"
        />
      </div>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
