import { Badge } from "@/components/admin/ui/Badge";
import { STATUS_LABEL, type LeadStatus } from "@/lib/lead-rules";

const TONE = { new: "accent", contacted: "success", closed: "neutral" } as const;

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
