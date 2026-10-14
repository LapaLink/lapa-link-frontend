import type { InfiniteData } from "@tanstack/react-query"
import type { ChatError, ChatMessage } from "@/types"

export const CHAT_PAGE_SIZE = 50

/** A history entry; `status` is set only for messages not yet confirmed by their echo. */
export type ChatFeedMessage = ChatMessage & { status?: "sending" | "failed" }

/** One fetched history page (newest to oldest) and the cursor of the next, older page. */
export type HistoryPage = { messages: ChatFeedMessage[]; nextCursor?: string }

export type HistoryData = InfiniteData<HistoryPage>

/**
 * The cursor is computed when the page is fetched, so live messages added to
 * the cache later do not change whether older history exists.
 */
export function toHistoryPage(
  messages: ChatMessage[],
  size = CHAT_PAGE_SIZE,
): HistoryPage {
  return {
    messages,
    nextCursor:
      messages.length < size ? undefined : messages[messages.length - 1]?.id,
  }
}

/** Flattens history pages into a feed ordered from oldest to newest without duplicates. */
export function flattenHistory(data: HistoryData | undefined) {
  const byKey = new Map<string, ChatFeedMessage>()
  for (const page of data?.pages ?? [])
    for (const message of page.messages) {
      const key = message.clientMessageId || message.id
      const existing = byKey.get(key)
      if (!existing || (existing.status && !message.status))
        byKey.set(key, message)
    }
  return [...byKey.values()].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  )
}

/**
 * Adds a message to cached history: a delivered message replaces the
 * optimistic one with the same clientMessageId, repeats are ignored.
 * Returns the same object when nothing changed.
 */
export function mergeMessage(
  data: HistoryData | undefined,
  message: ChatFeedMessage,
): HistoryData | undefined {
  if (!data?.pages.length) return data
  let replaced = false
  for (const page of data.pages)
    for (const entry of page.messages) {
      if (entry.id === message.id && !entry.status) return data
      if (entry.clientMessageId === message.clientMessageId) {
        if (!entry.status) return data
        replaced = true
      }
    }
  if (replaced)
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        messages: page.messages.map((entry) =>
          entry.clientMessageId === message.clientMessageId ? message : entry,
        ),
      })),
    }
  const [first, ...rest] = data.pages
  return {
    ...data,
    pages: [{ ...first, messages: [message, ...first.messages] }, ...rest],
  }
}

/** Sets the delivery status of unconfirmed messages with the given clientMessageIds. */
export function setMessageStatus(
  data: HistoryData | undefined,
  clientMessageIds: ReadonlySet<string>,
  status: "sending" | "failed",
): HistoryData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((entry) =>
        entry.status && clientMessageIds.has(entry.clientMessageId)
          ? { ...entry, status }
          : entry,
      ),
    })),
  }
}

/** Id of the newest delivered message in cached history, the cursor for `after`. */
export function lastConfirmedId(data: HistoryData | undefined) {
  const confirmed = flattenHistory(data).filter((message) => !message.status)
  return confirmed[confirmed.length - 1]?.id
}

/**
 * Loads messages newer than `after`, oldest first, page by page until a short
 * page. Capped so a misbehaving server cannot keep the loop running.
 */
export async function loadMessagesAfter(
  fetchPage: (after: string) => Promise<ChatMessage[]>,
  after: string,
  size = CHAT_PAGE_SIZE,
  maxPages = 20,
) {
  const messages: ChatMessage[] = []
  let cursor = after
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchPage(cursor)
    messages.push(...batch)
    if (batch.length < size) break
    cursor = batch[batch.length - 1].id
  }
  return messages
}

/**
 * Pending messages a send rejection applies to: the one it names, or every
 * pending message of the conversation when the server could not read the body.
 */
export function rejectedMessageIds(
  pending: Iterable<[string, { conversationId: string }]>,
  error: Pick<ChatError, "conversationId" | "clientMessageId">,
) {
  const ids: string[] = []
  for (const [id, { conversationId }] of pending)
    if (
      conversationId === error.conversationId &&
      (error.clientMessageId === null || error.clientMessageId === id)
    )
      ids.push(id)
  return ids
}
