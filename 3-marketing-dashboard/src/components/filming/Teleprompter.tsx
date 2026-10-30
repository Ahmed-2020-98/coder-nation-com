"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FlipHorizontal2, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { countWords } from "@/lib/script-math";

type Section = { key: string; label: string; text: string };
type Settings = { wpm: number; size: number; width: "narrow" | "medium" | "wide"; mirror: boolean; line: boolean; countdown: boolean };

const STORAGE_KEY = "coder-nation:prompter:v1";
const DEFAULTS: Settings = { wpm: 150, size: 56, width: "medium", mirror: false, line: true, countdown: true };
const WIDTH: Record<Settings["width"], string> = { narrow: "max-w-2xl", medium: "max-w-4xl", wide: "max-w-6xl" };

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Splits the script into lines and wraps unfilled [placeholders] so they stand out. */
function renderLine(text: string) {
  return text.split(/(\[[^\]]*\])/g).map((piece, index) =>
    /^\[.*\]$/.test(piece) ? (
      <mark key={index} className="rounded bg-primary-500/25 px-1.5 text-primary-300">{piece}</mark>
    ) : (
      <span key={index}>{piece}</span>
    ),
  );
}

type Props = { title: string; backHref: string; sections: Section[]; initialWpm: number };

/**
 * Full-screen teleprompter. Scrolling is time-based (requestAnimationFrame) and speed is in words per minute, so it
 * matches how fast you actually speak; the px/s is derived from the rendered text height. Settings are remembered.
 */
export default function Teleprompter({ title, backHref, sections, initialWpm }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = load();
    // first visit: start from the speaking rate in script-style.md (or the default 2.5 words/s)
    return window.localStorage.getItem(STORAGE_KEY) ? stored : { ...stored, wpm: initialWpm };
  });
  const [playing, setPlaying] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const scroller = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const totalWords = useMemo(() => Math.max(1, sections.reduce((sum, s) => sum + countWords(s.text), 0)), [sections]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode: settings just won't persist */
      }
      return next;
    });
  }, []);

  const wake = useCallback(() => {
    setUiVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3500);
  }, []);

  const reset = useCallback(() => {
    position.current = 0;
    if (scroller.current) scroller.current.scrollTop = 0;
    setFinished(false);
    setPlaying(false);
    setCount(null);
  }, []);

  const toggle = useCallback(() => {
    if (finished) {
      reset();
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (settings.countdown) setCount(3);
    else setPlaying(true);
  }, [finished, playing, reset, settings.countdown]);

  // 3 → 2 → 1 → go
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      const t = setTimeout(() => {
        setCount(null);
        setPlaying(true);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [count]);

  // the scroll loop
  useEffect(() => {
    const el = scroller.current;
    const body = text.current;
    if (!playing || !el || !body) return;
    let frame = 0;
    let last = performance.now();
    position.current = el.scrollTop;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // px per spoken word measured on the text block itself (the big top/bottom padding is not text)
      const pxPerWord = body.offsetHeight / totalWords;
      position.current += (settings.wpm / 60) * pxPerWord * dt;
      el.scrollTop = position.current;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        setPlaying(false);
        setFinished(true);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, settings.wpm, totalWords]);

  // keyboard
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest("input, select, textarea")) return;
      wake();
      switch (event.key) {
        case " ":
          event.preventDefault();
          toggle();
          break;
        case "ArrowUp":
          event.preventDefault();
          update({ wpm: Math.min(300, settings.wpm + 10) });
          break;
        case "ArrowDown":
          event.preventDefault();
          update({ wpm: Math.max(40, settings.wpm - 10) });
          break;
        case "+":
        case "=":
          update({ size: Math.min(120, settings.size + 4) });
          break;
        case "-":
          update({ size: Math.max(28, settings.size - 4) });
          break;
        case "m":
        case "M":
          update({ mirror: !settings.mirror });
          break;
        case "r":
        case "R":
        case "Home":
          reset();
          break;
        case "Escape":
          router.push(backHref);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backHref, reset, router, settings, toggle, update, wake]);

  const showUi = uiVisible || !playing;
  const btn = "grid size-11 place-items-center rounded-lg border border-line-strong text-ink hover:border-accent hover:text-accent";

  return (
    <div data-tone="navy" className="fixed inset-0 bg-secondary-950 text-white" onMouseMove={wake} onTouchStart={wake} role="application" aria-label={`Teleprompter: ${title}`}>
      <div
        ref={scroller}
        tabIndex={0}
        className="thin-scroll absolute inset-0 overflow-y-scroll"
        style={{ scrollbarWidth: "none" }}
        aria-label="نص السكريبت"
      >
        <div className={cn("mx-auto px-8 py-[40svh]", WIDTH[settings.width], settings.mirror && "prompter-mirror")} style={{ fontSize: `${settings.size}px`, lineHeight: 1.55 }}>
          <div ref={text}>
          {sections.map((section) => (
            <section key={section.key} className="mb-[0.9em]">
              <p dir="ltr" className="mb-[0.25em] font-mono text-[0.32em] font-bold tracking-wide text-primary-400">{section.label}</p>
              {section.text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
                <p key={index} className="mb-[0.5em] font-heading font-semibold">{renderLine(line)}</p>
              ))}
            </section>
          ))}
          </div>
          <p className="py-[10svh] text-center text-[0.5em] text-white/40">— انتهى —</p>
        </div>
      </div>

      {settings.line ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%] h-[0.2rem]">
          <div className="h-full bg-primary-500/90" />
          <div className="absolute inset-x-0 -top-[4.5rem] h-[4.5rem] bg-gradient-to-t from-primary-500/10 to-transparent" />
        </div>
      ) : null}

      {count !== null && count > 0 ? (
        <div role="status" aria-live="assertive" className="absolute inset-0 grid place-items-center bg-secondary-950/70">
          <span dir="ltr" className="font-mono text-[14rem] leading-none font-bold text-primary-500">{count}</span>
        </div>
      ) : null}

      {finished ? (
        <div role="status" className="absolute inset-x-0 bottom-28 grid place-items-center">
          <button type="button" onClick={reset} className="rounded-xl bg-primary-500 px-6 py-3 text-lg font-bold text-on-primary">
            خلص السكريبت • ابدأ من الأول
          </button>
        </div>
      ) : null}

      <div className={cn("absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-b from-secondary-950 to-transparent px-5 pt-4 pb-10 transition-opacity duration-300", showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
        <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-white/80 hover:text-white">
          <ArrowRight aria-hidden="true" className="size-4 ltr:rotate-180" />
          رجوع
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-white/60">{title}</p>
        <p className="hidden text-xs text-white/50 md:block">Space تشغيل • ↑↓ سرعة • +/- حجم • M انعكاس • R من الأول • Esc خروج</p>
      </div>

      <div className={cn("absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-secondary-950 to-transparent px-5 pt-10 pb-5 transition-opacity duration-300", showUi ? "opacity-100" : "pointer-events-none opacity-0")}>
        <button type="button" onClick={toggle} aria-label={playing ? "إيقاف" : "تشغيل"} className={cn(btn, "size-14 border-primary-500 bg-primary-500 text-on-primary hover:text-on-primary")}>
          {playing ? <Pause aria-hidden="true" className="size-6" /> : <Play aria-hidden="true" className="size-6" />}
        </button>
        <button type="button" onClick={reset} aria-label="ابدأ من الأول" className={btn}>
          <RotateCcw aria-hidden="true" className="size-5" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5">
          <label htmlFor="wpm" className="text-xs text-white/70">السرعة</label>
          <input id="wpm" type="range" min={40} max={300} step={5} value={settings.wpm} onChange={(e) => update({ wpm: Number(e.target.value) })} className="w-36 accent-primary-500" />
          <output dir="ltr" htmlFor="wpm" className="w-16 text-center font-mono text-sm">{settings.wpm} wpm</output>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1">
          <button type="button" onClick={() => update({ size: Math.max(28, settings.size - 4) })} aria-label="تصغير الخط" className="grid size-9 place-items-center rounded hover:text-accent"><Minus aria-hidden="true" className="size-4" /></button>
          <output dir="ltr" className="w-14 text-center font-mono text-sm">{settings.size}px</output>
          <button type="button" onClick={() => update({ size: Math.min(120, settings.size + 4) })} aria-label="تكبير الخط" className="grid size-9 place-items-center rounded hover:text-accent"><Plus aria-hidden="true" className="size-4" /></button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line-strong p-1" role="group" aria-label="عرض النص">
          {(["narrow", "medium", "wide"] as const).map((w) => (
            <button key={w} type="button" onClick={() => update({ width: w })} aria-pressed={settings.width === w} className={cn("h-9 rounded px-3 text-sm", settings.width === w ? "bg-white/15 font-semibold" : "text-white/70 hover:text-white")}>
              {w === "narrow" ? "ضيق" : w === "medium" ? "وسط" : "واسع"}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => update({ mirror: !settings.mirror })} aria-pressed={settings.mirror} className={cn(btn, settings.mirror && "border-primary-500 text-accent")} aria-label="انعكاس أفقي">
          <FlipHorizontal2 aria-hidden="true" className="size-5" />
        </button>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm">
          <input type="checkbox" checked={settings.line} onChange={(e) => update({ line: e.target.checked })} className="size-4 accent-primary-500" />
          خط القراءة
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm">
          <input type="checkbox" checked={settings.countdown} onChange={(e) => update({ countdown: e.target.checked })} className="size-4 accent-primary-500" />
          عدّ تنازلي
        </label>
      </div>
    </div>
  );
}
