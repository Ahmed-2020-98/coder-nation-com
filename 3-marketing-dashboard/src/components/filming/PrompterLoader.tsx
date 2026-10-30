"use client";

import dynamic from "next/dynamic";

// The teleprompter reads localStorage for its first render, so it is rendered in the browser only (no SSR mismatch).
const Teleprompter = dynamic(() => import("./Teleprompter"), {
  ssr: false,
  loading: () => (
    <div data-tone="navy" className="fixed inset-0 grid place-items-center bg-secondary-950 text-white/70" aria-busy="true">
      جاري التحميل…
    </div>
  ),
});

export { Teleprompter as PrompterClient };
