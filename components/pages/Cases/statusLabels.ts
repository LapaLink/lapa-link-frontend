import { Ban, CircleCheck, Clock, Lock, type LucideIcon } from "lucide-react"
import type {
  AssignmentStatus,
  CaseStatus,
  HelpApplicationStatus,
  NeedStatus,
} from "@/types"

export const caseStatusLabels: Record<CaseStatus, string> = {
  PENDING_REVIEW: "На проверке",
  OPEN: "Открыто",
  REJECTED: "Отклонено",
  CLOSED: "Закрыто",
}

export const caseStatusAppearance = {
  PENDING_REVIEW: { tone: "primary", icon: Clock },
  OPEN: { tone: "success", icon: CircleCheck },
  REJECTED: { tone: "danger", icon: Ban },
  CLOSED: { tone: "muted", icon: Lock },
} as const satisfies Record<
  CaseStatus,
  { tone: "primary" | "success" | "danger" | "muted"; icon: LucideIcon }
>

export const needStatusLabels: Record<NeedStatus, string> = {
  OPEN: "Ищем помощника",
  ASSIGNED: "Помощник выбран",
  CLOSED: "Закрыто",
}

export const responseStatusLabels: Record<HelpApplicationStatus, string> = {
  PENDING: "Ждёт ответа",
  ACCEPTED: "Выбран помощником",
  CANCELLED: "Отменено",
}

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: "Помощь в процессе",
  CANCELLED: "Отменено",
  COMPLETED: "Помощь оказана",
}
