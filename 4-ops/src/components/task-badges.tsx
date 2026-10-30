import { Badge } from "@/components/ui/Badge";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, type Priority, type ProjectStatus, type TaskStatus } from "@/lib/task-rules";

const STATUS_TONE: Record<TaskStatus, "neutral" | "accent" | "success" | "error"> = { todo: "neutral", doing: "accent", review: "accent", done: "success", blocked: "error" };
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => <Badge tone={STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>;

const PRIORITY_TONE: Record<Priority, "neutral" | "accent" | "success" | "error"> = { low: "neutral", normal: "neutral", high: "accent", urgent: "error" };
export const PriorityBadge = ({ priority }: { priority: Priority }) => <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;

const PROJECT_TONE: Record<ProjectStatus, "neutral" | "accent" | "success" | "error"> = { active: "accent", on_hold: "neutral", done: "success", cancelled: "error" };
export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => <Badge tone={PROJECT_TONE[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>;
