import type {
  ChatMessage,
  ChatPermission,
  ChatTargetType,
  Conversation,
  ConversationListParams,
  PageResponse,
} from "@/types"
import { authorizedRequest } from "./instance"

function query(
  params: Record<string, string | number | boolean | string[] | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value))
      value.forEach((item) => search.append(key, item))
    else if (value !== undefined && value !== "")
      search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ""
}

const permissionPath = (targetType: ChatTargetType, targetId: string) =>
  `/chat/permissions/${targetType}/${encodeURIComponent(targetId)}`
const conversationPath = (id: string) =>
  `/chat/conversations/${encodeURIComponent(id)}`
const messagePath = (conversationId: string, messageId: string) =>
  `${conversationPath(conversationId)}/messages/${encodeURIComponent(messageId)}`

/** Chat REST API: permissions, conversations and message history. Messages are sent over the socket. */
export const chatApi = {
  getPermission: (
    targetType: ChatTargetType,
    targetId: string,
    signal?: AbortSignal,
  ) =>
    authorizedRequest<ChatPermission>(permissionPath(targetType, targetId), {
      signal,
    }),
  /** Turns the chat for a target on or off. Only the target owner may call it. */
  setPermission: (
    targetType: ChatTargetType,
    targetId: string,
    enabled: boolean,
  ) =>
    authorizedRequest<ChatPermission>(permissionPath(targetType, targetId), {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  /** Requests a chat with the target owner; returns the existing conversation if there is one. */
  request: (targetType: ChatTargetType, targetId: string) =>
    authorizedRequest<Conversation>("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ targetType, targetId }),
    }),
  list: (params: ConversationListParams = {}, signal?: AbortSignal) =>
    authorizedRequest<PageResponse<Conversation>>(
      `/chat/conversations${query(params)}`,
      { signal },
    ),
  get: (id: string, signal?: AbortSignal) =>
    authorizedRequest<Conversation>(conversationPath(id), { signal }),
  accept: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/accept`, {
      method: "POST",
    }),
  decline: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/decline`, {
      method: "POST",
    }),
  /** Closes an active conversation for both participants; repeating it on a closed one is a no-op. */
  close: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/close`, {
      method: "POST",
    }),
  /**
   * Reopens a conversation the current user closed by hand. It stays CLOSED
   * (now with `closedBy: null`) when the chat conditions no longer hold and
   * then reopens by itself once they do.
   */
  reopen: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/reopen`, {
      method: "POST",
    }),
  /** Hides the conversation for the current user only and marks it read. A new message shows it again. */
  hide: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/hidden`, {
      method: "PUT",
    }),
  unhide: (id: string) =>
    authorizedRequest<Conversation>(`${conversationPath(id)}/hidden`, {
      method: "DELETE",
    }),
  /**
   * History page. With `before` (or nothing) it is ordered newest to oldest;
   * with `after` it holds newer messages ordered oldest to newest. The two
   * cursors cannot be combined.
   */
  messages: (
    id: string,
    {
      before,
      after,
      size,
    }: { before?: string; after?: string; size?: number } = {},
    signal?: AbortSignal,
  ) =>
    authorizedRequest<ChatMessage[]>(
      `${conversationPath(id)}/messages${query({ before, after, size })}`,
      { signal },
    ),
  /** Edits an own message; only while the conversation is writable. */
  editMessage: (conversationId: string, messageId: string, text: string) =>
    authorizedRequest<ChatMessage>(messagePath(conversationId, messageId), {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),
  /** Deletes an own message, also in a read-only conversation. Repeating it succeeds too. */
  deleteMessage: (conversationId: string, messageId: string) =>
    authorizedRequest<void>(messagePath(conversationId, messageId), {
      method: "DELETE",
    }),
  /** Unread messages across all conversations of the current user. */
  unreadCount: (signal?: AbortSignal) =>
    authorizedRequest<{ count: number }>("/chat/unread-count", { signal }),
  markRead: (id: string) =>
    authorizedRequest<void>(`${conversationPath(id)}/read`, {
      method: "POST",
    }),
}
