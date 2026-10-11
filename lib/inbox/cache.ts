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
