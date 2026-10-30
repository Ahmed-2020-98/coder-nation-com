// Future: the Coder Nation agent workspaces that live on their own sub-domains.
//
// Nothing here is rendered yet (every entry is `enabled: false`). The Footer already reads this
// list, so flipping a flag to `true` is all it takes to expose a link later.
// The Programming Agent is internal and has no sub-domain, so it is intentionally absent.
//
// Labels live in src/content (footer.ecosystemLabels), keyed by `id`.

export type EcosystemId = "marketing" | "sales" | "crm";

export type EcosystemLink = {
  id: EcosystemId;
  href: string;
  enabled: boolean;
};

export const ecosystem: EcosystemLink[] = [
  { id: "marketing", href: "https://marketing.codernation.com", enabled: false },
  { id: "sales", href: "https://sales.codernation.com", enabled: false },
  { id: "crm", href: "https://crm.codernation.com", enabled: false },
];
