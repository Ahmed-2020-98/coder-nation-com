import { AppShell } from "@/components/shell/AppShell";
import { getHealth } from "@/server/services/health";

// Everything here reads the filesystem and SQLite: never prerender it.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const health = await getHealth();
  return <AppShell health={health}>{children}</AppShell>;
}
