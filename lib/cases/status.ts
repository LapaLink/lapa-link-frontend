import type { CaseStatus } from "@/types"

export const caseStatusLabels: Record<CaseStatus, string> = {
  DRAFT: "Черновик",
  PENDING_REVIEW: "На проверке",
  OPEN: "Открыто",
  REJECTED: "Отклонено",
  CLOSED: "Закрыто",
  HIDDEN: "Скрыто модератором",
}

export function caseStatusLabel(status: string) {
  return Object.hasOwn(caseStatusLabels, status)
    ? caseStatusLabels[status as CaseStatus]
    : status
}
