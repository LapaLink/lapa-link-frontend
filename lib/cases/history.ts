import type { StatusHistoryItem } from "@/types"

type Event = Pick<
  StatusHistoryItem,
  "targetType" | "fromStatus" | "toStatus" | "actorId"
>

/**
 * Text of a status change. `needName` names the need of a NEED event; an
 * unknown pair of statuses shows raw values instead of breaking the feed.
 */
export function describeHistoryEvent(item: Event, needName: string) {
  const { targetType, fromStatus: from, toStatus: to } = item
  const need = `«${needName}»`
  if (targetType === "CASE") {
    if (from === null && to === "DRAFT") return "Создан черновик"
    if ((from === null || from === "DRAFT") && to === "PENDING_REVIEW")
      return "Отправлено на модерацию"
    if (
      (from === null || from === "DRAFT" || from === "PENDING_REVIEW") &&
      to === "OPEN"
    )
      return "Опубликовано"
    if (from === "PENDING_REVIEW" && to === "REJECTED")
      return "Отклонено модератором"
    if (to === "CLOSED") return "Объявление закрыто"
  }
  if (targetType === "NEED") {
    if (from === null && to === "OPEN") return `Добавлена потребность ${need}`
    if (from === "OPEN" && to === "ASSIGNED")
      return `${need}: выбран исполнитель`
    if (from === "ASSIGNED" && to === "OPEN")
      return `${need}: снова ищем помощника`
    if (to === "CLOSED")
      return item.actorId === null
        ? `${need}: закрыта (срок истёк)`
        : `${need}: закрыта`
  }
  if (targetType === "ASSIGNMENT") {
    if (from === null && to === "ACTIVE") return "Назначен исполнитель"
    if (from === "ACTIVE" && to === "COMPLETED") return "Помощь оказана"
    if (from === "ACTIVE" && to === "CANCELLED") return "Назначение отменено"
  }
  if (targetType === "HELP_APPLICATION") {
    if (from === null && to === "PENDING") return "Новый отклик"
    if (from === "PENDING" && to === "ACCEPTED") return "Отклик принят"
    if (to === "CANCELLED") return "Отклик отменён"
  }
  return `${targetType}: ${from ?? "—"} → ${to}`
}

/**
 * Who made the change: the system, the current user, the author, a helper
 * (assignments and responses) or a moderator (case changes by others).
 */
export function historyActor(
  item: Pick<StatusHistoryItem, "targetType" | "actorId">,
  { authorId, userId }: { authorId: string; userId?: string },
) {
  if (item.actorId === null) return "Автоматически"
  if (item.actorId === userId) return "Вы"
  if (item.actorId === authorId) return "Автор"
  return item.targetType === "CASE" ? "Модератор" : "Исполнитель"
}
