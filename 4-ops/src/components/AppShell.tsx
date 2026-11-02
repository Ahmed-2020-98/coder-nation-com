"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Building2, FileCheck2, KeyRound, FileSignature, FileText, Clock, FolderKanban, Handshake, LayoutDashboard, ListChecks, LogOut, Receipt, Users, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, type Role } from "@/lib/crm-rules";

const ICONS = { home: LayoutDashboard, deals: Handshake, clients: Users, proposals: FileText, company: Building2, team: UsersRound, tasks: ListChecks, projects: FolderKanban, attendance: Clock, contracts: FileSignature, clientContracts: FileCheck2, invoices: Receipt, keys: KeyRound } as const;
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** Navy sidebar (top bar on small screens) + a light workspace. The items are decided on the server from the role. */
export function AppShell({ user, nav, children }: { user: { name: string; email: string; role: Role }; nav: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  // "/crm" must not light up while on "/crm/clients": the longest matching href wins.
  const current = nav.filter((item) => isActive(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside data-tone="navy" className="glow-corner bg-canvas text-ink lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:pt-6 lg:pb-5">
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg" aria-label="Coder Nation Ops: الرئيسية">
            <span dir="ltr" className="inline-flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-primary-500 font-mono text-[0.8rem] font-bold text-on-primary">
                {"</>"}
              </span>
              <span className="font-heading text-[1.05rem] leading-none font-bold">
                Coder<span className="text-accent">Nation</span>
              </span>
            </span>
          </Link>
          <p className="hidden text-xs font-semibold text-ink-muted lg:mt-6 lg:block">النظام الداخلي</p>
        </div>

        <nav aria-label="التنقل الرئيسي" className="px-3 pb-3 lg:flex-1 lg:pb-0">
          <ul className="flex gap-1 overflow-x-auto lg:grid">
            {nav.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === current;
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
                    <Icon aria-hidden="true" className={cn("size-[1.15rem] shrink-0", active && "text-accent")} strokeWidth={1.85} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden border-t border-line p-4 lg:block">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-ink-muted" dir="ltr" title={user.email}>
            {user.email}
          </p>
          <p className="mt-1 text-xs text-accent">{ROLE_LABEL[user.role]}</p>
          <div className="mt-2 flex items-center gap-1">
            <Link href="/account/password" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-ink-muted hover:text-ink">
              الباسورد
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-muted hover:text-ink">
                <LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                خروج
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div data-tone="light" className="relative min-w-0 bg-canvas text-ink">
        <a className="skip-link" href="#main">
          انتقل إلى المحتوى
        </a>
        <main id="main" className="mx-auto w-full max-w-[76rem] px-(--gutter) py-7 lg:py-9">
          {children}
        </main>
        <div className="flex items-center justify-center gap-4 border-t border-line px-(--gutter) py-3 text-sm lg:hidden">
          <Link href="/account/password" className="inline-flex min-h-11 items-center font-semibold text-ink-muted">
            الباسورد
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink-muted">
              <LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
              خروج ({user.name})
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
