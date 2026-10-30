import type { ReactNode } from "react";

type Props = {
  /** "02" — the section number, shown like a code comment. */
  index: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Every page starts the same way: a numbered eyebrow, the title, one line of purpose, and page-level actions. */
export function PageHeader({ index, title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <p dir="ltr" className="w-fit font-mono text-sm font-semibold text-accent">
          {"// "}
          {index}
        </p>
        <h1 className="mt-1 text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-bold">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
