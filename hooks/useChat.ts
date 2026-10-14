"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { chatApi } from "@/api"
import { getSessionRevision, readTokens } from "@/lib/auth"
import {
  CHAT_PAGE_SIZE,
  mergeMessage,
  toHistoryPage,
  type HistoryData,
} from "@/lib/chat"
import { invalidateChatData, queryKeys } from "@/lib/queryKeys"
import type {
  ChatMessage,
  ChatPermission,
  ChatTargetType,
  Conversation,
  ConversationListParams,
} from "@/types"

export function useChatPermission(
  targetType: ChatTargetType,
  targetId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.chatPermission(targetType, targetId),
    queryFn: ({ signal }) => chatApi.getPermission(targetType, targetId, signal),
    enabled,
  })
}

/** Owner switch for the chat of a target, applied optimistically. */
export function useSetChatPermission(
  targetType: ChatTargetType,
  targetId: string,
) {
  const client = useQueryClient()
  const key = queryKeys.chatPermission(targetType, targetId)
  const set = (enabled: boolean) =>
    client.setQueryData<ChatPermission>(key, (current) =>
      current ? { ...current, enabled } : current,
    )
  return useMutation({
    mutationFn: (enabled: boolean) =>
      chatApi.setPermission(targetType, targetId, enabled),
    onMutate: async (enabled) => {
      await client.cancelQueries({ queryKey: key })
      set(enabled)
    },
    onSuccess: (result) => client.setQueryData(key, result),
    onError: (_error, enabled) => set(!enabled),
    onSettled: () =>
      client.invalidateQueries({ queryKey: queryKeys.conversationLists }),
  })
}

export function useConversations(
  params: ConversationListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.conversations(params),
    queryFn: ({ signal }) => chatApi.list(params, signal),
    enabled,
  })
}

const PARTICIPANTS_PER_REQUEST = 50

/**
 * Conversations about a target with the given users (one per user at most),
 * e.g. the helpers on the current page of case responses. Requests are split
 * by 50 users because a list page holds at most 50 conversations.
 */
export function useParticipantConversations(
  targetType: ChatTargetType,
  targetId: string,
  userIds: string[],
  enabled: boolean,
) {
  const ids = [...new Set(userIds)].sort().slice(0, 100)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += PARTICIPANTS_PER_REQUEST)
    chunks.push(ids.slice(i, i + PARTICIPANTS_PER_REQUEST))
  return useQueries({
    queries: chunks.map((participantId) => {
      const params = {
        targetType,
        targetId,
        participantId,
        size: PARTICIPANTS_PER_REQUEST,
      }
      return {
        queryKey: queryKeys.conversations(params),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          chatApi.list(params, signal),
        enabled,
      }
    }),
    combine: (results) => ({
      conversations: results.flatMap((result) => result.data?.content ?? []),
      isPending: results.some((result) => result.isPending),
      error: results.find((result) => result.error)?.error ?? null,
    }),
  })
}

/** Unread messages across all conversations; kept current by socket pushes. */
export function useChatUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatUnreadCount,
    queryFn: ({ signal }) => chatApi.unreadCount(signal),
    enabled,
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: ({ signal }) => chatApi.get(id, signal),
  })
}

/**
 * History of a conversation, newest page first. Live messages are merged into
 * the cache by ChatProvider, so refetches are limited to explicit reconciliation.
 */
export function useChatMessages(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.chatMessages(id),
    queryFn: async ({ pageParam, signal }) =>
      toHistoryPage(
        await chatApi.messages(
          id,
          { before: pageParam, size: CHAT_PAGE_SIZE },
          signal,
        ),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

function useConversationMutation(
  mutationFn: (variables: string) => Promise<Conversation>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const revision = getSessionRevision()
      const conversation = await mutationFn(id)
      if (revision === getSessionRevision() && readTokens())
        client.setQueryData(queryKeys.conversation(conversation.id), conversation)
      return conversation
    },
    // Errors such as CONVERSATION_NOT_REQUESTED mean the list is outdated.
    onSettled: () => invalidateChatData(client),
  })
}

export const useRequestChat = (targetType: ChatTargetType) =>
  useConversationMutation((targetId) => chatApi.request(targetType, targetId))
export const useAcceptConversation = () =>
  useConversationMutation(chatApi.accept)
export const useDeclineConversation = () =>
  useConversationMutation(chatApi.decline)
export const useCloseConversation = () => useConversationMutation(chatApi.close)
export const useReopenConversation = () =>
  useConversationMutation(chatApi.reopen)
export const useHideConversation = () => useConversationMutation(chatApi.hide)
export const useUnhideConversation = () =>
  useConversationMutation(chatApi.unhide)

/**
 * Runs a request that changes a message and puts the result into cached
 * history right away; the socket push that follows is then a no-op.
 */
function useMessageMutation<V>(
  conversationId: string,
  request: (variables: V) => Promise<ChatMessage>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (variables: V) => {
      const revision = getSessionRevision()
      const message = await request(variables)
      if (revision === getSessionRevision() && readTokens())
        client.setQueryData<HistoryData>(
          queryKeys.chatMessages(conversationId),
          (data) => mergeMessage(data, message),
        )
      return message
    },
  })
}

/** Edits an own delivered message. */
export const useEditMessage = (conversationId: string) =>
  useMessageMutation(
    conversationId,
    ({ messageId, text }: { messageId: string; text: string }) =>
      chatApi.editMessage(conversationId, messageId, text),
  )

/** Deletes an own delivered message; it stays in history without its text. */
export const useDeleteMessage = (conversationId: string) =>
  useMessageMutation(
    conversationId,
    async (message: ChatMessage) => {
      await chatApi.deleteMessage(conversationId, message.id)
      return { ...message, text: null, deletedAt: new Date().toISOString() }
    },
  )
