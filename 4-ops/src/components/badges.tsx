import { Badge } from "@/components/ui/Badge";
import { CLIENT_CONTRACT_STATUS_LABEL, INVOICE_STATUS_LABEL, type ClientContractStatus, type InvoiceStatus } from "@/lib/client-contract-rules";
import { CONTRACT_STATUS_LABEL, type ContractStatus } from "@/lib/contract-rules";
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

const CONTRACT_TONE: Record<ContractStatus, "neutral" | "accent" | "success" | "error"> = { draft: "neutral", sent: "accent", accepted: "success", declined: "error" };
export const ContractBadge = ({ status }: { status: ContractStatus }) => <Badge tone={CONTRACT_TONE[status]}>{CONTRACT_STATUS_LABEL[status]}</Badge>;

const PROPOSAL_TONE: Record<ProposalStatus, "neutral" | "accent" | "success" | "error"> = { draft: "neutral", sent: "accent", accepted: "success", rejected: "error" };
export const ProposalBadge = ({ status }: { status: ProposalStatus }) => <Badge tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>;

const CLIENT_CONTRACT_TONE: Record<ClientContractStatus, "neutral" | "accent" | "success" | "error"> = { draft: "neutral", ready: "accent", signed: "success", cancelled: "error" };
export const ClientContractBadge = ({ status }: { status: ClientContractStatus }) => <Badge tone={CLIENT_CONTRACT_TONE[status]}>{CLIENT_CONTRACT_STATUS_LABEL[status]}</Badge>;

export const InvoiceBadge = ({ status }: { status: InvoiceStatus }) => <Badge tone={status === "issued" ? "success" : "error"}>{INVOICE_STATUS_LABEL[status]}</Badge>;
