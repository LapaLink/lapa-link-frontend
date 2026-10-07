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
  OPEN: "Открыто",
  ASSIGNED: "Исполнитель выбран",
  CLOSED: "Закрыто",
}

export const responseStatusLabels: Record<HelpApplicationStatus, string> = {
  PENDING: "Ожидает решения",
  ACCEPTED: "Принят",
  CANCELLED: "Отменён",
}

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: "В работе",
  CANCELLED: "Отменено",
  COMPLETED: "Завершено",
}
