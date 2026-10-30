import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { leadStats } from "@/server/leads";
import { requireAdmin } from "@/server/session";

/**
 * Every panel page lives under this gate. It reads the session cookie, so it is dynamic and sits in Suspense
 * (Cache Components); pages, actions and route handlers still call requireAdmin() themselves.
 */
async function Gate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const stats = await leadStats().catch(() => ({ fresh: 0 }));
  return (
    <AdminShell email={admin.email} newLeads={stats.fresh}>
      {children}
    </AdminShell>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-svh place-items-center" role="status" aria-label="جارٍ التحميل">
          <span className="spin size-8 rounded-full border-2 border-line-strong border-t-primary-500" />
        </div>
      }
    >
      <Gate>{children}</Gate>
    </Suspense>
  );
}
