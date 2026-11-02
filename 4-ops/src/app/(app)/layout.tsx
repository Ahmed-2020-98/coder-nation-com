import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { listContracts } from "@/server/contracts";
import { can } from "@/server/permissions";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const nav: NavItem[] = [
    { href: "/", label: "الرئيسية", icon: "home" },
    { href: "/crm", label: "الصفقات", icon: "deals" },
    { href: "/tasks", label: "المهام", icon: "tasks" },
    { href: "/projects", label: "المشاريع", icon: "projects" },
    { href: "/attendance", label: "الحضور", icon: "attendance" },
    ...(can(user.role, "client.manage") ? [{ href: "/crm/clients", label: "العملاء", icon: "clients" } as NavItem] : []),
    ...(can(user.role, "proposal.view") ? [{ href: "/proposals", label: "العروض", icon: "proposals" } as NavItem] : []),
    ...(can(user.role, "client_contract.manage") ? [{ href: "/client-contracts", label: "عقود العملاء", icon: "clientContracts" } as NavItem] : []),
    ...(can(user.role, "invoice.issue") ? [{ href: "/invoices", label: "الفواتير", icon: "invoices" } as NavItem] : []),
    ...(can(user.role, "company.edit") ? [{ href: "/settings/company", label: "بيانات الشركة", icon: "company" } as NavItem] : []),
    ...(can(user.role, "users.manage") ? [{ href: "/settings/users", label: "الفريق", icon: "team" } as NavItem] : []),
    // The owner manages every contract; anyone else sees the entry only once a contract has been sent to them.
    ...(can(user.role, "contract.manage")
      ? [{ href: "/contracts", label: "العقود", icon: "contracts" } as NavItem]
      : (await listContracts({ userId: user.id }).catch(() => [])).length > 0
        ? [{ href: "/contracts", label: "عقودي", icon: "contracts" } as NavItem]
        : []),
  ];
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }} nav={nav}>
      {children}
    </AppShell>
  );
}
