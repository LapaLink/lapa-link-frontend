import type {
  AssignmentStatus,
  CaseStatus,
  HelpApplicationStatus,
  NeedStatus,
} from "@/types"

export const caseStatusLabels: Record<CaseStatus, string> = {
  OPEN: "Открыто",
  CLOSED: "Закрыто",
}

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
