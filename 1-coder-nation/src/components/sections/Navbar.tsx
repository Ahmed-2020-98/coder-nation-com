"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { content } from "@/content";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

const sectionIds = content.nav.links.map((link) => link.href.slice(1));

export function Navbar() {
  const { nav, a11y } = content;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");

  // Frosted background once the page leaves the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlights the link of the section currently crossing the middle of the viewport.
  useEffect(() => {
    const targets = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-tone="navy"
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-(--duration-base)",
        scrolled || open
          ? "border-line bg-canvas/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-(--header-h) w-full max-w-page items-center justify-between gap-6 px-(--gutter)">
        <a href="#top" aria-label={a11y.home} className="rounded-lg">
          <Logo />
        </a>

        <nav aria-label={a11y.mainNav} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.links.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 items-center rounded-lg px-3.5 text-[0.95rem] font-medium transition-colors duration-(--duration-fast)",
                      "after:absolute after:inset-x-3.5 after:bottom-1.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-primary-500 after:transition-transform after:duration-(--duration-base) rtl:after:origin-right",
                      isActive ? "text-accent after:scale-x-100" : "text-ink-muted hover:text-ink hover:after:scale-x-100",
                    )}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button href={nav.cta.href} className="max-sm:hidden">
            {nav.cta.label}
          </Button>
          <button
            type="button"
            className="grid size-11 cursor-pointer place-items-center rounded-lg border border-line-strong text-ink transition-colors hover:border-accent hover:text-accent lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? a11y.closeMenu : a11y.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className="menu-in border-t border-line lg:hidden">
          <nav aria-label={a11y.mainNav} className="mx-auto w-full max-w-page px-(--gutter) py-4">
            <ul className="grid gap-1">
              {nav.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center rounded-lg px-3 text-lg font-medium text-ink hover:bg-white/5 hover:text-accent"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li className="pt-3">
                <Button href={nav.cta.href} size="lg" className="w-full" onClick={() => setOpen(false)}>
                  {nav.cta.label}
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
