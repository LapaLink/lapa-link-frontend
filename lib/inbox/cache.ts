import type { InboxNotification, PageResponse } from "@/types"

export function prependNotification(
  page: PageResponse<InboxNotification> | undefined,
  item: InboxNotification,
) {
  if (
    !page ||
    page.page !== 0 ||
    page.content.some((entry) => entry.id === item.id)
  )
    return page
  const totalElements = page.totalElements + 1
  const totalPages = Math.ceil(totalElements / page.size)
  return {
    ...page,
    content: [item, ...page.content].slice(0, page.size),
    totalElements,
    totalPages,
    last: totalPages <= 1,
  }
}

/**
 * Modal queue after a mandatory notification arrived or was clicked: deduped
 * by id; `front` makes it the one shown now, otherwise it waits at the end.
 */
export function enqueueMandatory(
  queue: InboxNotification[] | undefined,
  item: InboxNotification,
  front = false,
) {
  const rest = (queue ?? []).filter((entry) => entry.id !== item.id)
  if (front) return [item, ...rest]
  return (queue ?? []).some((entry) => entry.id === item.id)
    ? (queue ?? [])
    : [...rest, item]
}
