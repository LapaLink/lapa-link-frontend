"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, chatApi, getErrorMessage } from "@/api"
import { useAuth, startChatSocket, type ChatSocketStatus } from "@/hooks"
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/auth"
import {
  CHAT_PAGE_SIZE,
  lastConfirmedId,
  loadMessagesAfter,
  mergeConversation,
  mergeMessage,
  rejectedMessageIds,
  setMessageStatus,
  type HistoryData,
} from "@/lib/chat"
import { invalidateChatData, queryKeys } from "@/lib/queryKeys"
import type { ChatMessage, Conversation, PageResponse } from "@/types"

const SEND_TIMEOUT = 10_000
const READ_THROTTLE = 1500

type ChatEngine = {
  sendMessage: (conversationId: string, text: string, retryId?: string) => void
  markRead: (conversationId: string) => void
}

type ChatContextValue = Pick<ChatEngine, "sendMessage"> & {
  status: ChatSocketStatus
  /** Marks a conversation as on screen: it is read now and on new messages. Returns cleanup. */
  watch: (conversationId: string) => () => void
}

const ChatContext = createContext<ChatContextValue>({
  status: "disconnected",
  sendMessage: () => {},
  watch: () => () => {},
})

/** Chat socket state and actions for the signed-in user. */
export function useChatSocket() {
  return useContext(ChatContext)
}

/**
 * Keeps one chat socket per session (keyed like NotificationsProvider) and
 * merges delivered messages, conversation updates and the unread total into
 * the query cache. Sending is optimistic:
 * a message is confirmed by its echo and marked failed after 10 seconds or
 * a rejection; while offline it waits in the outbox until reconnect.
 */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  )
  const [status, setStatus] = useState<ChatSocketStatus>("connecting")
  const engine = useRef<ChatEngine | null>(null)
  // Lives outside the connection: a page's effect may register before the socket starts.
  const openRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    const current = () => getSessionSnapshot() === session
    const outbox = new Map<
      string,
      { conversationId: string; text: string; timer: ReturnType<typeof setTimeout> }
    >()
    const readTimers = new Map<string, ReturnType<typeof setTimeout>>()

    const applyConversation = (conversation: Conversation) => {
      client.setQueryData(queryKeys.conversation(conversation.id), conversation)
      let found = false
      client.setQueriesData<PageResponse<Conversation>>(
        { queryKey: queryKeys.conversationLists },
        (page) => {
          const merged = mergeConversation(page, conversation)
          if (merged !== page) found = true
          return merged
        },
      )
      if (!found)
        void client.invalidateQueries({ queryKey: queryKeys.conversationLists })
      // Request state, enabled flag and eligibility may have changed with it.
      void client.invalidateQueries({
        queryKey: queryKeys.chatPermission(
          conversation.targetType,
          conversation.targetId,
        ),
      })
    }
    // Unread counters follow through the conversation and unread-count pushes.
    const markRead = (id: string) => {
      void chatApi.markRead(id).catch(() => {})
    }
    const scheduleRead = (id: string) => {
      if (readTimers.has(id)) return
      readTimers.set(
        id,
        setTimeout(() => {
          readTimers.delete(id)
          if (current() && openRef.current === id) markRead(id)
        }, READ_THROTTLE),
      )
    }
    const markFailed = (conversationId: string, ids: string[]) =>
      client.setQueryData<HistoryData>(
        queryKeys.chatMessages(conversationId),
        (data) => setMessageStatus(data, new Set(ids), "failed"),
      )
    const merge = (message: ChatMessage) =>
      client.setQueryData<HistoryData>(
        queryKeys.chatMessages(message.conversationId),
        (data) => mergeMessage(data, message),
      )
    const flush = () => {
      outbox.forEach(({ conversationId, text }, clientMessageId) =>
        socket.send(conversationId, { clientMessageId, text }),
      )
    }
    const fetchUnreadCount = () =>
      void client
        .fetchQuery({
          queryKey: queryKeys.chatUnreadCount,
          queryFn: ({ signal }) => chatApi.unreadCount(signal),
          staleTime: 0,
        })
        .catch(() => {})
    // Pushes may have been missed while offline: refresh conversations, load
    // the open conversation's newer messages and drop the other histories.
    const catchUp = async () => {
      const id = openRef.current
      void invalidateChatData(client)
      client.removeQueries({
        queryKey: [...queryKeys.chat, "messages"],
        predicate: (query) => query.queryKey[2] !== id,
      })
      const data = id
        ? client.getQueryData<HistoryData>(queryKeys.chatMessages(id))
        : undefined
      if (!id || !data) return
      const after = lastConfirmedId(data)
      const messages = after
        ? await loadMessagesAfter(
            (cursor) =>
              chatApi.messages(id, { after: cursor, size: CHAT_PAGE_SIZE }),
            after,
          )
        : await chatApi.messages(id, { size: CHAT_PAGE_SIZE })
      if (current()) messages.forEach(merge)
    }
    let connectedBefore = false

    const socket = startChatSocket({
      isCurrent: current,
      onStatus: (next) => {
        if (!current()) return
        setStatus(next)
        if (next !== "connected") return
        if (connectedBefore) void catchUp().catch(() => {})
        else fetchUnreadCount()
        connectedBefore = true
        flush()
      },
      onMessage: (message) => {
        const pending = outbox.get(message.clientMessageId)
        if (pending) {
          clearTimeout(pending.timer)
          outbox.delete(message.clientMessageId)
        }
        merge(message)
        if (
          message.senderId !== userId &&
          openRef.current === message.conversationId &&
          document.visibilityState === "visible"
        )
          scheduleRead(message.conversationId)
      },
      onConversation: applyConversation,
      onUnreadCount: (count) =>
        client.setQueryData(queryKeys.chatUnreadCount, { count }),
      onError: (error) => {
        const ids = rejectedMessageIds(outbox, error)
        ids.forEach((id) => {
          clearTimeout(outbox.get(id)?.timer)
          outbox.delete(id)
        })
        markFailed(error.conversationId, ids)
        toast.error(
          error.message ||
            getErrorMessage(
              new ApiError("", 409, error.error),
              "Сообщение не отправлено.",
            ),
        )
      },
      onClosed: ({ code, message }) =>
        toast.error(
          message ||
            getErrorMessage(new ApiError("", 403, code), "Чат недоступен."),
        ),
    })

    const onVisibility = () => {
      const id = openRef.current
      if (id && document.visibilityState === "visible") scheduleRead(id)
    }
    document.addEventListener("visibilitychange", onVisibility)

    engine.current = {
      sendMessage(conversationId, text, retryId) {
        const clientMessageId = retryId ?? crypto.randomUUID()
        const key = queryKeys.chatMessages(conversationId)
        if (retryId)
          client.setQueryData<HistoryData>(key, (data) =>
            setMessageStatus(data, new Set([retryId]), "sending"),
          )
        else
          client.setQueryData<HistoryData>(key, (data) =>
            mergeMessage(data, {
              id: clientMessageId,
              conversationId,
              senderId: userId,
              clientMessageId,
              text,
              createdAt: new Date().toISOString(),
              status: "sending",
            }),
          )
        clearTimeout(outbox.get(clientMessageId)?.timer)
        const timer = setTimeout(() => {
          if (outbox.get(clientMessageId)?.timer !== timer) return
          outbox.delete(clientMessageId)
          markFailed(conversationId, [clientMessageId])
        }, SEND_TIMEOUT)
        outbox.set(clientMessageId, { conversationId, text, timer })
        // Offline messages stay in the outbox and are flushed on reconnect.
        socket.send(conversationId, { clientMessageId, text })
      },
      markRead,
    }
    const opened = openRef.current
    if (opened && document.visibilityState === "visible") markRead(opened)

    return () => {
      engine.current = null
      socket.stop()
      document.removeEventListener("visibilitychange", onVisibility)
      outbox.forEach(({ timer }) => clearTimeout(timer))
      readTimers.forEach(clearTimeout)
      setStatus("connecting")
      void client.cancelQueries({ queryKey: queryKeys.chat })
      client.removeQueries({ queryKey: queryKeys.chat })
    }
  }, [client, session, userId])

  const sendMessage = useCallback<ChatContextValue["sendMessage"]>(
    (...args) => engine.current?.sendMessage(...args),
    [],
  )
  const watch = useCallback((id: string) => {
    openRef.current = id
    if (document.visibilityState === "visible") engine.current?.markRead(id)
    return () => {
      if (openRef.current === id) openRef.current = null
    }
  }, [])
  const value = useMemo<ChatContextValue>(
    () => ({
      status: userId ? status : "disconnected",
      sendMessage,
      watch,
    }),
    [sendMessage, status, userId, watch],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
