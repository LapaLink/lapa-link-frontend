import { z } from "zod"
import { ROUTES } from "@/lib/constants"

export const unreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
})
export const inboxNotificationSchema = z.object({
  id: z.uuid(),
  eventType: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.boolean(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  caseId: z.uuid().nullable().default(null),
  needId: z.uuid().nullable().default(null),
  responseId: z.uuid().nullable().default(null),
  assignmentId: z.uuid().nullable().default(null),
  actionUrl: z.string().nullable().default(null),
  mandatory: z.boolean().optional(),
})

/** Same-site case link; with `needId` the case page opens and highlights that need. */
export function notificationHref(value: string | null, needId?: string | null) {
  if (!value || !/^\/cases\/[a-f0-9-]{36}$/i.test(value)) return null
  return needId && /^[a-f0-9-]{36}$/i.test(needId)
    ? `${value}?need=${needId}`
    : value
}

const ADOPTION_EVENTS = [
  "CASE_ADOPTION_REQUEST_CREATED",
  "CASE_ADOPTION_REQUEST_CANCELLED",
  "ADOPTION_REQUEST_STATUS_CHANGED",
]

/**
 * Where a notification leads: its `actionUrl`. Deadline reminders and expired
 * needs (NEED_*) fall back to their case; anything else without `actionUrl`
 * (e.g. a MODERATION_WARNING about a user) leads nowhere.
 */
export function inboxItemHref(item: {
  eventType: string
  actionUrl: string | null
  caseId: string | null
  needId: string | null
}) {
  if (item.eventType === "BADGE_AWARDED") return ROUTES.MY_BADGES
  // The answer waits in the support chat; actionUrl is null there.
  if (item.eventType === "SUPPORT_QUESTION_ANSWERED") return "/support#latest"
  // Adoption events open the case at its adoption block.
  if (ADOPTION_EVENTS.includes(item.eventType)) {
    const href = notificationHref(item.actionUrl)
    return href && `${href}#adoption`
  }
  return (
    notificationHref(item.actionUrl, item.needId) ??
    (item.eventType.startsWith("NEED_")
      ? notificationHref(item.caseId && `/cases/${item.caseId}`, item.needId)
      : null)
  )
}

export function navigateToInboxItem(href: string, push: (url: string) => void) {
  // Account switches its sections on hashchange, which Next pushState does not emit.
  if (href === ROUTES.MY_BADGES && window.location.pathname === ROUTES.ACCOUNT)
    window.location.hash = new URL(href, window.location.origin).hash
  else push(href)
}

/** Parse incremental UTF-8 SSE, including fragmented CRLF and multiline data. */
export async function consumeEvents(
  response: Response,
  onEvent: (event: string, data: string) => void,
  onChunk: () => void = () => {},
) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = "",
    event = "message",
    data: string[] = []
  function line(value: string) {
    if (!value) {
      if (data.length) onEvent(event, data.join("\n"))
      event = "message"
      data = []
      return
    }
    if (value.startsWith(":")) return
    const colon = value.indexOf(":")
    const key = colon < 0 ? value : value.slice(0, colon)
    const content = colon < 0 ? "" : value.slice(colon + 1).replace(/^ /, "")
    if (key === "event") event = content
    if (key === "data") data.push(content)
  }
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      onChunk()
      buffer += decoder.decode(chunk.value, { stream: true })
      if (buffer.length + data.join("\n").length > 1_000_000)
        throw new Error("SSE event too large")
      while (true) {
        const position = buffer.search(/[\r\n]/)
        if (
          position < 0 ||
          (buffer[position] === "\r" && position === buffer.length - 1)
        )
          break
        const length = buffer.slice(position, position + 2) === "\r\n" ? 2 : 1
        line(buffer.slice(0, position))
        buffer = buffer.slice(position + length)
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
