"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Clapperboard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Health } from "@/server/services/health";

const NAV = [
  { href: "/", label: "لوحة المتابعة", index: "01", icon: LayoutDashboard, hint: "Pipeline" },
  { href: "/research", label: "Research", index: "02", icon: Search, hint: "تحليل الكومنتات" },
  { href: "/script", label: "السكريبت", index: "03", icon: FileText, hint: "كتابة وتعديل" },
  { href: "/filming", label: "التصوير والمونتاج", index: "04", icon: Clapperboard, hint: "Shot list وخطة" },
  { href: "/posting", label: "النشر", index: "05", icon: CalendarClock, hint: "كابشن وتقويم" },
  { href: "/training", label: "التدريب", index: "06", icon: GraduationCap, hint: "أسلوبك" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

type DotState = "ok" | "bad" | "unknown";

const DOT_TEXT: Record<DotState, string> = { ok: "تمام", bad: "ناقص", unknown: "جاري الفحص" };
const DOT_TONE: Record<DotState, { text: string; dot: string }> = {
  ok: { text: "text-success-300", dot: "bg-success-300" },
  bad: { text: "text-error-300", dot: "bg-error-300" },
  unknown: { text: "text-ink-muted", dot: "bg-ink-muted" },
};

function Dot({ state, label, text, title }: { state: DotState; label: string; text?: string; title?: string }) {
  const tone = DOT_TONE[state];
  return (
    <li className="flex items-center justify-between gap-2 text-xs" title={title}>
      <span className="text-ink-muted">{label}</span>
      <span className={cn("inline-flex items-center gap-1.5 font-medium", tone.text)}>
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
        {text ?? DOT_TEXT[state]}
      </span>
    </li>
  );
}

/** What to show for "who are the agents signed in as". Never includes anything secret; the email is only a tooltip. */
function authDot(health: Health): { state: DotState; label: string; text?: string; title?: string } {
  if (health.simulated) return { state: "ok", label: "Agents (محاكاة)" };
  const { auth } = health;
  switch (auth.method) {
    case "subscription":
      return { state: "ok", label: "دخول Claude", text: auth.plan ? `اشتراك ${auth.plan[0].toUpperCase()}${auth.plan.slice(1)}` : "اشتراك", title: auth.email };
    case "api_key":
      return { state: "ok", label: "دخول Claude", text: "API key" };
    case "cloud":
      return { state: "ok", label: "دخول Claude", text: auth.provider ?? "cloud" };
    case "none":
      return { state: "bad", label: "دخول Claude", text: "مش مسجّل" };
    default:
      return { state: "unknown", label: "دخول Claude" };
  }
}

function SidebarContent({ health, pathname, onNavigate }: { health: Health; pathname: string; onNavigate?: () => void }) {
  const agentsOk = health.expectedAgents.every((name) => health.agents.includes(name));
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="mx-4 mt-5 mb-6 inline-flex w-fit items-center gap-2.5 rounded-lg" aria-label="Coder Nation: لوحة المتابعة">
        <span dir="ltr" className="inline-flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary-500 font-mono text-[0.8rem] font-bold text-on-primary">
            {"</>"}
          </span>
          <span className="font-heading text-[1.05rem] leading-none font-bold">
            Coder<span className="text-accent">Nation</span>
          </span>
        </span>
      </Link>

      <p className="mx-5 mb-2 text-xs font-semibold text-ink-muted">Marketing Agent</p>
      <nav aria-label="التنقل الرئيسي" className="px-3">
        <ul className="grid gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-12 items-center gap-3 rounded-lg px-3 transition-colors duration-(--duration-fast)",
                    active ? "bg-white/8 text-ink" : "text-ink-muted hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {active ? <span aria-hidden="true" className="absolute inset-y-2 start-0 w-1 rounded-full bg-primary-500" /> : null}
                  <item.icon aria-hidden="true" className={cn("size-[1.15rem] shrink-0", active && "text-accent")} strokeWidth={1.85} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] leading-5 font-semibold">{item.label}</span>
                    <span className="block text-xs leading-4 text-ink-muted">{item.hint}</span>
                  </span>
                  <span dir="ltr" className="font-mono text-xs text-ink-muted/70">
                    {item.index}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-3 mt-auto mb-4 rounded-xl border border-line p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-bold">حالة النظام</p>
          {health.simulated ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold text-accent">وضع تجريبي</span> : null}
        </div>
        <ul className="grid gap-1.5">
          <Dot {...authDot(health)} />
          <Dot state={health.ffmpeg && health.ffprobe ? "ok" : "bad"} label="ffmpeg" />
          <Dot state={agentsOk && health.orchestratorFile ? "ok" : "bad"} label={`الـ Agents ${health.agents.length}/${health.expectedAgents.length}`} />
        </ul>
        <p className="mt-2.5 border-t border-line pt-2 text-xs leading-5 text-ink-muted">
          الأسلوب: السكريبت {health.styles.scriptTrained ? "مُدرَّب" : "مسودة"} • المونتاج {health.styles.montageTrained ? "مُدرَّب" : "مسودة"}
        </p>
      </div>
    </div>
  );
}

/** The app frame: a navy sidebar on the start side (right in RTL) and the light workspace beside it. */
export function AppShell({ health, children }: { health: Health; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const notLoggedIn = !health.simulated && health.auth.method === "none";

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <aside data-tone="navy" className="glow-corner sticky top-0 hidden h-svh bg-canvas text-ink lg:block">
        <SidebarContent health={health} pathname={pathname} />
      </aside>

      {/* tablet / small desktop: top bar + drawer */}
      <div data-tone="navy" className="sticky top-0 z-40 flex h-14 items-center justify-between bg-canvas px-4 text-ink lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="فتح القائمة"
          aria-expanded={drawer}
          aria-controls="mobile-nav"
          className="grid size-10 place-items-center rounded-lg border border-line-strong"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <span dir="ltr" className="font-heading font-bold">
          Coder<span className="text-accent">Nation</span>
        </span>
      </div>
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="إغلاق القائمة" className="absolute inset-0 bg-secondary-950/60" onClick={() => setDrawer(false)} />
          <div id="mobile-nav" data-tone="navy" className="absolute inset-y-0 end-0 w-[min(20rem,88vw)] bg-canvas text-ink shadow-window [animation:fade-in_0.25s_both]">
            <button type="button" onClick={() => setDrawer(false)} aria-label="إغلاق" className="absolute end-3 top-4 grid size-9 place-items-center rounded-lg text-ink-muted hover:text-ink">
              <X aria-hidden="true" className="size-5" />
            </button>
            <SidebarContent health={health} pathname={pathname} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div data-tone="light" className="relative min-w-0 bg-canvas text-ink">
        <div aria-hidden="true" className="blueprint pointer-events-none absolute inset-x-0 top-0 h-72" />
        <a className="skip-link" href="#main">
          انتقل إلى المحتوى
        </a>
        {notLoggedIn ? (
          <div role="alert" className="relative border-b border-error-500/40 bg-error-500/10 px-[var(--gutter)] py-2.5 text-sm">
            <p className="mx-auto flex max-w-workspace items-start gap-2.5">
              <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-error-700" />
              <span>
                <strong className="text-error-700">مش مسجّل دخول لـ Claude.</strong> الصفحات شغّالة، لكن تشغيل الـ Agents مش هيشتغل. شغّل{" "}
                <code dir="ltr" className="rounded bg-canvas-alt px-1.5 py-0.5 font-mono text-xs">
                  claude
                </code>{" "}
                في الـ terminal واعمل{" "}
                <code dir="ltr" className="rounded bg-canvas-alt px-1.5 py-0.5 font-mono text-xs">
                  /login
                </code>
                ، أو حط مفتاح API في ملف{" "}
                <code dir="ltr" className="rounded bg-canvas-alt px-1.5 py-0.5 font-mono text-xs">
                  .env.local
                </code>
                ، وبعدين حدّث الصفحة.
              </span>
            </p>
          </div>
        ) : null}
        <main id="main" className="relative mx-auto w-full max-w-workspace px-[var(--gutter)] py-7 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
