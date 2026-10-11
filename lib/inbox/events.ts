import { z } from "zod"

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
  caseId: z.uuid().nullable(),
  needId: z.uuid().nullable(),
  responseId: z.uuid().nullable(),
  assignmentId: z.uuid().nullable(),
  actionUrl: z.string().nullable(),
})

export function notificationHref(value: string | null) {
  return value && /^\/cases\/[a-f0-9-]{36}$/i.test(value) ? value : null
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
