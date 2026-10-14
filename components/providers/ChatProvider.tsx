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
  createTypingStore,
  lastConfirmedId,
  loadMessagesAfter,
  mergeConversation,
  mergeMessage,
  rejectedMessageIds,
  setMessageStatus,
  type HistoryData,
  type TypingStore,
} from "@/lib/chat"
import { invalidateChatData, queryKeys } from "@/lib/queryKeys"
import type {
  ChatMessage,
  Conversation,
  ConversationListParams,
  PageResponse,
} from "@/types"

const SEND_TIMEOUT = 10_000
const READ_THROTTLE = 1500

type ChatEngine = {
  sendMessage: (conversationId: string, text: string, retryId?: string) => void
  markRead: (conversationId: string) => void
  /** Returns false when the socket is not connected; the event is then dropped. */
  sendTyping: (conversationId: string, typing: boolean) => boolean
}

type ChatContextValue = Pick<ChatEngine, "sendMessage" | "sendTyping"> & {
  status: ChatSocketStatus
  /** Marks a conversation as on screen: it is read now and on new messages. Returns cleanup. */
  watch: (conversationId: string) => () => void
  typing: TypingStore
}

const ChatContext = createContext<ChatContextValue>({
  status: "disconnected",
  sendMessage: () => {},
  sendTyping: () => false,
  watch: () => () => {},
  typing: createTypingStore(),
})

/** Chat socket state and actions for the signed-in user. */
export function useChatSocket() {
  return useContext(ChatContext)
}

/** Ids of the other users typing in the conversation right now. */
export function useTypingUsers(conversationId: string) {
  const { typing } = useContext(ChatContext)
  const subscribe = typing.subscribe
  const get = useCallback(
    () => typing.get(conversationId),
    [typing, conversationId],
  )
  return useSyncExternalStore(subscribe, get, get)
}

/**
 * Keeps one chat socket per session (keyed like NotificationsProvider) and
 * merges delivered messages (new, edited and deleted), conversation updates
 * and the unread total into the query cache and tracks who is typing. Sending is optimistic:
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
  const [typing] = useState(createTypingStore)
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

    const listHidden = (key: readonly unknown[]) =>
      (key[2] as ConversationListParams | undefined)?.hidden
    const applyConversation = (conversation: Conversation) => {
      client.setQueryData(queryKeys.conversation(conversation.id), conversation)
      let found = false
      let moved = false
      for (const [key, page] of client.getQueriesData<
        PageResponse<Conversation>
      >({ queryKey: queryKeys.conversationLists })) {
        const merged = mergeConversation(page, conversation, listHidden(key))
        if (!page || !merged || merged === page) continue
        client.setQueryData(key, merged)
        if (merged.content.length < page.content.length) moved = true
        else found = true
      }
      if (!found)
        void client.invalidateQueries({ queryKey: queryKeys.conversationLists })
      // Hidden or shown again: the list on the other side has to pick it up.
      else if (moved)
        void client.invalidateQueries({
          queryKey: queryKeys.conversationLists,
          predicate: (query) => listHidden(query.queryKey) === conversation.hidden,
        })
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
    // `after` holds only new messages, so the latest page is fetched again
    // for edits and deletions made in the meantime.
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
      const [latest, newer] = await Promise.all([
        chatApi.messages(id, { size: CHAT_PAGE_SIZE }),
        after
          ? loadMessagesAfter(
              (cursor) =>
                chatApi.messages(id, { after: cursor, size: CHAT_PAGE_SIZE }),
              after,
            )
          : [],
      ])
      if (current()) [...latest, ...newer].forEach(merge)
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
        if (!message.editedAt && !message.deletedAt)
          typing.set(message.conversationId, message.senderId, false)
        if (
          message.senderId !== userId &&
          openRef.current === message.conversationId &&
          document.visibilityState === "visible"
        )
          scheduleRead(message.conversationId)
      },
      onConversation: applyConversation,
      onTyping: ({ conversationId, userId: typingUserId, typing: active }) => {
        if (typingUserId !== userId)
          typing.set(conversationId, typingUserId, active)
      },
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
              editedAt: null,
              deletedAt: null,
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
      sendTyping: socket.sendTyping,
    }
    const opened = openRef.current
    if (opened && document.visibilityState === "visible") markRead(opened)

    return () => {
      engine.current = null
      socket.stop()
      document.removeEventListener("visibilitychange", onVisibility)
      outbox.forEach(({ timer }) => clearTimeout(timer))
      readTimers.forEach(clearTimeout)
      typing.clear()
      setStatus("connecting")
      void client.cancelQueries({ queryKey: queryKeys.chat })
      client.removeQueries({ queryKey: queryKeys.chat })
    }
  }, [client, session, typing, userId])

  const sendMessage = useCallback<ChatContextValue["sendMessage"]>(
    (...args) => engine.current?.sendMessage(...args),
    [],
  )
  const sendTyping = useCallback<ChatContextValue["sendTyping"]>(
    (...args) => engine.current?.sendTyping(...args) ?? false,
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
      sendTyping,
      watch,
      typing,
    }),
    [sendMessage, sendTyping, status, typing, userId, watch],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
