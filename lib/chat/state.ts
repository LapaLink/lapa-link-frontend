import type {
  ChatMessage,
  ChatPermission,
  Conversation,
  ConversationParticipant,
  ConversationStatus,
} from "@/types"
import { ROUTES } from "@/lib/constants"

/** What a user who offered help sees in the chat block of a case page. */
export type CaseChatAction =
  | "hidden"
  | "loading"
  | "disabled"
  | "request"
  | "requested"
  | "open"
  | "declined"

/**
 * Picks the chat control for a non-author on a case page from the permission
 * response alone. Own conversation state wins, so a disabled chat still leads
 * to its read-only history. The "chat is off" hint is shown only to users who
 * offered help (`hasActiveResponse`), so other visitors see nothing.
 */
export function caseChatAction({
  isAuthor,
  hasActiveResponse,
  permission,
}: {
  isAuthor: boolean
  hasActiveResponse: boolean
  /** Undefined while loading. */
  permission:
    | Pick<ChatPermission, "enabled" | "canRequest" | "conversationStatus">
    | undefined
}): CaseChatAction {
  if (isAuthor) return "hidden"
  if (!permission) return "loading"
  // A closed conversation still leads to its read-only history.
  if (
    permission.conversationStatus === "ACTIVE" ||
    permission.conversationStatus === "CLOSED"
  )
    return "open"
  if (permission.conversationStatus === "REQUESTED") return "requested"
  if (permission.conversationStatus === "DECLINED") return "declined"
  if (permission.canRequest) return "request"
  return !permission.enabled && hasActiveResponse ? "disabled" : "hidden"
}

export const conversationStatusLabels: Record<ConversationStatus, string> = {
  REQUESTED: "Ожидает ответа автора",
  ACTIVE: "Активный",
  DECLINED: "Запрос отклонён",
  CLOSED: "Диалог закрыт",
}

/** Days the server keeps a closed conversation before deleting it with its messages. */
export const CLOSED_CONVERSATION_TTL_DAYS = 14

/** When the server deletes a closed conversation; null while it is not closed. */
export function conversationDeletionDate(
  conversation: Pick<Conversation, "status" | "closedAt">,
) {
  if (conversation.status !== "CLOSED" || !conversation.closedAt) return null
  return new Date(
    Date.parse(conversation.closedAt) +
      CLOSED_CONVERSATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  )
}

/** True when the participant has read the message (read up to its createdAt or later). */
export function isReadBy(
  message: Pick<ChatMessage, "createdAt">,
  participant: Pick<ConversationParticipant, "lastReadAt"> | undefined,
) {
  if (!participant?.lastReadAt) return false
  return Date.parse(message.createdAt) <= Date.parse(participant.lastReadAt)
}

/** The other participant of a conversation for the current user. */
export function counterpart(
  conversation: Pick<Conversation, "participants">,
  userId: string | undefined,
): ConversationParticipant | undefined {
  return conversation.participants.find(
    (participant) => participant.userId !== userId,
  )
}

/** The user who requested the chat. */
export function initiator(conversation: Pick<Conversation, "participants">) {
  return conversation.participants.find(
    (participant) => participant.role === "INITIATOR",
  )
}

/** True when the current user owns the chat target and decides on requests. */
export function isConversationOwner(
  conversation: Pick<Conversation, "participants">,
  userId: string | undefined,
) {
  return conversation.participants.some(
    (participant) =>
      participant.userId === userId && participant.role === "OWNER",
  )
}

/** Link to the object the conversation is about. */
export function conversationTargetHref(
  conversation: Pick<Conversation, "targetType" | "targetId">,
) {
  return conversation.targetType === "CASE"
    ? ROUTES.CASE_DETAILS(conversation.targetId)
    : null
}
