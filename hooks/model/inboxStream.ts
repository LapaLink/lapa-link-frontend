import { ApiError, inboxApi } from "@/api"
import { readTokens } from "@/lib/auth"
import {
  consumeEvents,
  inboxNotificationSchema,
  unreadCountSchema,
} from "@/lib/inbox"
import type { InboxNotification } from "@/types"

export function startInboxStream({
  isCurrent,
  onConnected,
  onNotification,
  onCount,
}: {
  isCurrent: () => boolean
  onConnected: () => void
  onNotification: (item: InboxNotification) => void
  onCount: (count: number) => void
}) {
  const lifetime = new AbortController()
  let retry: ReturnType<typeof setTimeout> | undefined
  let retryResolve: (() => void) | undefined
  const seen = new Set<string>()
  const active = () => !lifetime.signal.aborted && isCurrent() && !!readTokens()
  async function run() {
    let delay = 1000
    while (active()) {
      const connection = new AbortController()
      let watchdog: ReturnType<typeof setTimeout> | undefined
      const heartbeat = () => {
        clearTimeout(watchdog)
        watchdog = setTimeout(() => connection.abort(), 60_000)
      }
      let wait = delay
      try {
        const response = await inboxApi.stream(
          AbortSignal.any([lifetime.signal, connection.signal]),
        )
        if (!active()) {
          await response.body?.cancel()
          break
        }
        heartbeat()
        onConnected()
        const started = Date.now()
        await consumeEvents(
          response,
          (event, json) => {
            if (!active()) return
            try {
              const payload: unknown = JSON.parse(json)
              if (event === "unread-count") {
                const count = unreadCountSchema.safeParse(payload)
                if (count.success) onCount(count.data.count)
              }
              if (event === "notification") {
                const item = inboxNotificationSchema.safeParse(payload)
                if (item.success && !seen.has(item.data.id)) {
                  seen.add(item.data.id)
                  if (seen.size > 500) seen.delete(seen.values().next().value!)
                  onNotification(item.data)
                }
              }
            } catch {
              /* Ignore malformed events; REST remains the source of truth. */
            }
          },
          heartbeat,
        )
        if (Date.now() - started > 30_000) delay = 1000
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) break
          if (error.retryAfterSeconds)
            wait = Math.max(wait, error.retryAfterSeconds * 1000)
        }
      } finally {
        clearTimeout(watchdog)
        connection.abort()
      }
      if (!active()) break
      await new Promise<void>((resolve) => {
        retryResolve = resolve
        retry = setTimeout(resolve, wait)
      })
      retryResolve = undefined
      delay = Math.min(delay * 2, 30_000)
    }
  }
  void run()
  return () => {
    lifetime.abort()
    clearTimeout(retry)
    retryResolve?.()
  }
}
