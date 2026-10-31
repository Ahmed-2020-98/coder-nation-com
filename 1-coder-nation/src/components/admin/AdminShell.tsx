"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FilePen, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { logoutAction } from "@/app/(admin)/admin/actions";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/admin/leads", label: "طلبات العملاء", icon: Users },
  { href: "/admin/content", label: "محتوى الموقع", icon: FilePen },
  { href: "/admin/settings", label: "إعدادات الموقع", icon: Settings },
] as const;

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

/** Navy sidebar (top bar on small screens) + a light workspace, the same frame as the marketing dashboard. */
export function AdminShell({ email, newLeads, children }: { email: string; newLeads: number; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside data-tone="navy" className="glow-corner bg-canvas text-ink lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:pt-6 lg:pb-5">
          <Link href="/admin" className="inline-flex items-center gap-2.5 rounded-lg" aria-label="Coder Nation: لوحة التحكم">
            <span dir="ltr" className="inline-flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary-500 font-mono text-[0.8rem] font-bold text-on-primary">
                {"</>"}
              </span>
              <span className="font-heading text-[1.05rem] leading-none font-bold">
                Coder<span className="text-accent">Nation</span>
              </span>
            </span>
          </Link>
          <p className="hidden text-xs font-semibold text-ink-muted lg:mt-6 lg:block">لوحة التحكم</p>
        </div>

        <nav aria-label="التنقل الرئيسي" className="px-3 pb-3 lg:flex-1 lg:pb-0">
          <ul className="flex gap-1 overflow-x-auto lg:grid">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-semibold transition-colors duration-(--duration-fast)",
                      active ? "bg-white/8 text-ink" : "text-ink-muted hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    {active ? <span aria-hidden="true" className="absolute inset-y-2 start-0 hidden w-1 rounded-full bg-primary-500 lg:block" /> : null}
                    <item.icon aria-hidden="true" className={cn("size-[1.15rem] shrink-0", active && "text-accent")} strokeWidth={1.85} />
                    {item.label}
                    {item.href === "/admin/leads" && newLeads > 0 ? (
                      <span className="ms-auto rounded-full bg-primary-500 px-2 text-xs leading-5 font-bold text-on-primary" aria-label={`${newLeads} طلب جديد`}>
                        {newLeads}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden border-t border-line p-4 lg:block">
          <p className="truncate text-xs text-ink-muted" dir="ltr" title={email}>
            {email}
          </p>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-muted hover:text-ink">
              <LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      <div data-tone="light" className="relative min-w-0 bg-canvas text-ink">
        <a className="skip-link" href="#main">
          انتقل إلى المحتوى
        </a>
        <main id="main" className="mx-auto w-full max-w-[72rem] px-(--gutter) py-7 lg:py-9">
          {children}
        </main>
        <form action={logoutAction} className="border-t border-line px-(--gutter) py-3 text-center lg:hidden">
          <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold text-ink-muted">
            <LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
            تسجيل الخروج ({email})
          </button>
        </form>
      </div>
    </div>
  );
}
