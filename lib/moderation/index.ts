import { z } from "zod"

export const userStatusLabels: Record<string, string> = {
  PENDING_VERIFICATION: "Почта не подтверждена",
  ACTIVE: "Активен",
  SUSPENDED: "Доступ приостановлен",
  BLOCKED: "Заблокирован",
  DELETED: "Удалён",
}

export function canModerate(
  user: { roles: readonly string[] } | null | undefined,
) {
  return !!user?.roles.some((role) => role === "MODERATOR" || role === "ADMIN")
}

export const moderationDecisionSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Напишите причину решения.")
    .max(500, "Используйте не больше 500 символов."),
})

export const reportStatusLabels = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  RESOLVED: "Рассмотрена",
  REJECTED: "Отклонена",
}
export const reportTargetLabels = {
  CASE: "Объявление",
  USER: "Пользователь",
  CONVERSATION: "Переписка",
}
export const resolutionLabels: Record<string, string> = {
  WARNING_SENT: "Отправлено предупреждение",
  CASE_CLOSED: "Объявление закрыто",
  CASE_HIDDEN: "Объявление скрыто",
  CASE_DELETED: "Объявление удалено",
  CHAT_CLOSED: "Переписка закрыта",
}
