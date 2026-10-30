import { Badge } from "@/components/ui/Badge";
import { PROPOSAL_STATUS_LABEL, STAGE_LABEL, type ProposalStatus, type Stage } from "@/lib/crm-rules";

const STAGE_TONE: Record<Stage, "neutral" | "accent" | "success" | "error"> = {
  new: "accent",
  contacted: "neutral",
  meeting: "neutral",
  proposal_sent: "accent",
  negotiation: "accent",
  won: "success",
  lost: "error",
};

export const StageBadge = ({ stage }: { stage: Stage }) => <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;

const PROPOSAL_TONE: Record<ProposalStatus, "neutral" | "accent" | "success" | "error"> = { draft: "neutral", sent: "accent", accepted: "success", rejected: "error" };
export const ProposalBadge = ({ status }: { status: ProposalStatus }) => <Badge tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>;
