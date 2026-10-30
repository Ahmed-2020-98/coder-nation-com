"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <Toaster>");
  return context;
}

const ICON = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const STYLE: Record<Tone, string> = {
  success: "border-success-500/40 [&_svg]:text-success-700",
  error: "border-error-500/50 [&_svg]:text-error-700",
  info: "border-line-strong [&_svg]:text-accent",
};

/**
 * Transient messages. Successes and info vanish after 4s, errors after 7s (long enough to read, never sticky), and
 * every toast can be dismissed. Errors use role="alert"; the rest are polite live-region updates.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = ++counter.current;
      setToasts((all) => [...all.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed end-4 bottom-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICON[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm text-ink shadow-lift",
                "[animation:toast-in_0.3s_var(--ease-out-expo)_both]",
                STYLE[toast.tone],
              )}
            >
              <Icon aria-hidden="true" className="mt-1 size-4 shrink-0" />
              <p className="flex-1 leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="إغلاق"
                className="grid size-6 shrink-0 place-items-center rounded text-ink-muted hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
