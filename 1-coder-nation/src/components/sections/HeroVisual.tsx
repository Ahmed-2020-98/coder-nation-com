import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { content } from "@/content";
import type { CodeKind } from "@/content/ar";

// Typing speed and timeline of the hero animation (ms).
const CHAR_MS = 18;
const TYPE_START = 900;

const tokenClass: Record<CodeKind, string> = {
  kw: "text-primary-400",
  str: "text-success-300",
  fn: "text-secondary-100",
  id: "text-white",
  punc: "text-secondary-300",
  cmt: "text-secondary-400 italic",
};

const LINE_GAP_MS = 70;

const vars = (v: Record<string, string | number>) => v as CSSProperties;

// Static timeline, computed once: every line starts when the previous one has finished typing.
const { visual } = content.hero;
const durations = visual.codeLines.map(
  (tokens) => Math.max(tokens.reduce((n, [, text]) => n + text.length, 0), 1) * CHAR_MS,
);
const lines = visual.codeLines.map((tokens, i) => ({
  tokens,
  chars: durations[i] / CHAR_MS,
  dur: durations[i],
  delay: TYPE_START + durations.slice(0, i).reduce((sum, d) => sum + d + LINE_GAP_MS, 0),
}));
const typingEnd = TYPE_START + durations.reduce((sum, d) => sum + d + LINE_GAP_MS, 0);

/**
 * Decorative hero art: an editor window that "writes" the project, a build toast and a phone mock.
 * Everything is CSS/SVG (no images). It is hidden from assistive tech: the hero text carries the message.
 */
export function HeroVisual() {
  return (
    <div aria-hidden="true" dir="ltr" className="relative mx-auto w-full max-w-[34rem] pb-14 lg:ms-auto">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary-500/20 blur-3xl" />

      {/* Editor window */}
      <figure
        className="pop-in overflow-hidden rounded-xl bg-secondary-950/90 shadow-window backdrop-blur"
        style={vars({ "--d": "250ms" })}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-secondary-600" />
          <span className="size-2.5 rounded-full bg-secondary-600" />
          <span className="size-2.5 rounded-full bg-primary-500" />
          <span className="ms-3 inline-flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 font-mono text-xs text-secondary-200">
            <span className="size-1.5 rounded-full bg-primary-400" />
            {visual.fileName}
          </span>
        </div>

        <pre className="overflow-hidden py-5 font-mono text-[0.78rem] leading-7 sm:text-sm">
          <code className="block">
            {lines.map((line, i) => (
              <span key={i} className="flex min-h-7">
                <span className="w-10 shrink-0 pe-4 text-end text-secondary-500 select-none">{i + 1}</span>
                <span
                  className="code-type whitespace-pre"
                  style={vars({ "--chars": line.chars, "--dur": `${line.dur}ms`, "--delay": `${line.delay}ms` })}
                >
                  {line.tokens.map(([kind, text], j) => (
                    <span key={j} className={tokenClass[kind]}>
                      {text}
                    </span>
                  ))}
                </span>
              </span>
            ))}
            <span className="flex min-h-7">
              <span className="w-10 shrink-0 pe-4 text-end text-secondary-500 select-none">{lines.length + 1}</span>
              <span className="caret" />
            </span>
          </code>
        </pre>
      </figure>

      {/* Build toast: overlaps the window's top edge */}
      <div
        className="pop-in absolute -top-5 end-3 rounded-lg border border-white/10 bg-secondary-900/95 px-3.5 py-2.5 font-mono text-xs shadow-window sm:end-8"
        style={vars({ "--d": `${typingEnd + 250}ms` })}
      >
        <p className="text-secondary-300">
          <span className="text-primary-400">$</span> {visual.buildCommand}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-success-300">
          <Check className="size-3.5" strokeWidth={2.5} />
          {visual.buildResult}
        </p>
      </div>

      {/* Phone mock: overlaps the window's bottom corner */}
      <div className="absolute -bottom-2 -right-1 w-[7.25rem] sm:-right-7 sm:w-[8.5rem]">
        <div className="pop-in" style={vars({ "--d": "1100ms" })}>
          <div className="float">
            <div className="rounded-[1.7rem] border border-white/15 bg-secondary-950 p-1.5 shadow-window">
              <div className="relative aspect-[9/18] overflow-hidden rounded-[1.3rem] bg-secondary-800">
                <span className="absolute start-1/2 top-1.5 h-1.5 w-9 -translate-x-1/2 rounded-full bg-secondary-950" />
                <div className="mt-7 flex items-center gap-1.5 px-2.5">
                  <span className="size-4 rounded-md bg-primary-500" />
                  <span className="font-heading text-[0.55rem] font-bold text-white">{visual.phoneAppName}</span>
                </div>
                <div className="shimmer mx-2.5 mt-2.5 h-14 rounded-lg" />
                <div className="mt-2.5 grid gap-2 px-2.5">
                  {[0, 1, 2].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="size-6 shrink-0 rounded-md bg-secondary-600" />
                      <div className="grid flex-1 gap-1">
                        <span className="h-1.5 w-4/5 rounded bg-secondary-500" />
                        <span className="h-1.5 w-1/2 rounded bg-secondary-700" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-x-2.5 bottom-2 flex justify-between rounded-md bg-secondary-950/80 px-3 py-1.5">
                  {[0, 1, 2, 3].map((n) => (
                    <span key={n} className={n === 0 ? "size-2 rounded-full bg-primary-500" : "size-2 rounded-full bg-secondary-600"} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
