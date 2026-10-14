import { Client, ReconnectionTimeMode } from "@stomp/stompjs"
import {
  ApiError,
  getPreferredLocale,
  refreshTokens,
  waitForRefresh,
} from "@/api"
import { readTokens, saveTokens } from "@/lib/auth"
import {
  chatErrorSchema,
  chatMessageSchema,
  conversationSchema,
  parseFrame,
  resolveStompError,
  unreadCountSchema,
} from "@/lib/chat"
import type { ChatError, ChatMessage, Conversation, Tokens } from "@/types"

export type ChatSocketStatus = "connecting" | "connected" | "disconnected"
export type ChatSendPayload = { clientMessageId: string; text: string }

/** Same-origin `/ws`, proxied to the backend by the `/ws` rewrite in next.config.ts. */
function socketUrl() {
  const { protocol, host } = window.location
  return `${protocol === "https:" ? "wss:" : "ws:"}//${host}/ws`
}

/**
 * One STOMP connection per session: delivers chat messages (including the
 * echo of own messages), send rejections, conversation updates and the total
 * unread count. Reconnects with exponential backoff (1s → 30s), refreshes an
 * expired access token, reconnects with a token replaced elsewhere and stops
 * for good once the session ends or `stop` is called.
 */
export function startChatSocket({
  isCurrent,
  onMessage,
  onError,
  onConversation,
  onUnreadCount,
  onStatus,
  onClosed,
}: {
  isCurrent: () => boolean
  onMessage: (message: ChatMessage) => void
  onError: (error: ChatError) => void
  onConversation: (conversation: Conversation) => void
  onUnreadCount: (count: number) => void
  onStatus: (status: ChatSocketStatus) => void
  /** The server refused the connection for good (blocked user, no access). */
  onClosed: (error: { code: string; message: string }) => void
}) {
  const seen = new Set<string>()
  let stopped = false
  let used: Tokens | null = null
  let expired: Tokens | null = null
  let decision: Promise<void> | null = null
  const client = new Client({
    brokerURL: socketUrl(),
    connectionTimeout: 20_000,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
    reconnectDelay: 1000,
    maxReconnectDelay: 30_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
  })
  const active = () => !stopped && isCurrent() && !!readTokens()
  const stop = () => {
    if (stopped) return
    stopped = true
    void client.deactivate()
  }

  client.beforeConnect = async () => {
    // Do not reconnect before the previous ERROR has been resolved.
    await decision
    if (expired) {
      const stale = expired
      expired = null
      try {
        await refreshTokens(stale)
      } catch (error) {
        // A rejected refresh ends the session; anything else is retried on the next attempt.
        if (error instanceof ApiError && error.status === 401) return stop()
        expired = stale
      }
    }
    const tokens = readTokens()
    if (!active() || !tokens) return stop()
    used = tokens
    client.connectHeaders = {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Accept-Language": getPreferredLocale(),
    }
    onStatus("connecting")
  }
  client.onConnect = () => {
    if (!active()) return stop()
    client.subscribe("/user/queue/messages", (frame) => {
      const message = parseFrame(chatMessageSchema, frame.body)
      if (!message || !active() || seen.has(message.id)) return
      seen.add(message.id)
      if (seen.size > 500) seen.delete(seen.values().next().value!)
      onMessage(message)
    })
    client.subscribe("/user/queue/errors", (frame) => {
      const error = parseFrame(chatErrorSchema, frame.body)
      if (error && active()) onError(error)
    })
    client.subscribe("/user/queue/conversations", (frame) => {
      const conversation = parseFrame(conversationSchema, frame.body)
      if (conversation && active()) onConversation(conversation)
    })
    client.subscribe("/user/queue/unread-count", (frame) => {
      const unread = parseFrame(unreadCountSchema, frame.body)
      if (unread && active()) onUnreadCount(unread.count)
    })
    onStatus("connected")
  }
  client.onStompError = (frame) => {
    const code = frame.headers.message ?? ""
    const stale = used
    const current = (async () => {
      // A refresh (here or in another tab) replaces the token and makes the
      // server close this socket; let it save the new token before deciding.
      if (code.startsWith("TOKEN_") || code === "SESSION_NOT_FOUND")
        await waitForRefresh().catch(() => {})
      const action = resolveStompError(
        code,
        stale?.accessToken ?? null,
        readTokens()?.accessToken ?? null,
      )
      if (action === "refresh") expired = stale
      if (action === "logout") {
        // Same as authorizedRequest: clear only the session this socket used.
        if (stale && readTokens()?.accessToken === stale.accessToken)
          saveTokens(null)
        stop()
      }
      if (action === "stop") {
        stop()
        onClosed({ code, message: frame.body })
      }
    })()
    decision = current
    void current.finally(() => {
      if (decision === current) decision = null
    })
  }
  client.onWebSocketClose = () => {
    if (!active()) stop()
    onStatus("disconnected")
  }

  if (active()) client.activate()
  return {
    /** Publishes a message; false when the socket is not connected. */
    send(conversationId: string, payload: ChatSendPayload) {
      if (!active() || !client.connected) return false
      client.publish({
        destination: `/app/conversations/${encodeURIComponent(conversationId)}/messages`,
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      })
      return true
    },
    stop,
  }
}

export type ChatSocket = ReturnType<typeof startChatSocket>
