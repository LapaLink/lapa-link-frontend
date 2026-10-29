export type ChatTargetType = "CASE"
export type ConversationStatus = "REQUESTED" | "ACTIVE" | "DECLINED" | "CLOSED"
export type ConversationRole = "OWNER" | "INITIATOR"

export type ChatPermission = {
  targetType: ChatTargetType
  targetId: string
  enabled: boolean
  /** Server-side eligibility: chat on, active response, not the owner, target open, no own conversation. */
  canRequest: boolean
  /** The conversation the current user requested for this target. */
  conversationId: string | null
  conversationStatus: ConversationStatus | null
}

export type ConversationParticipant = {
  userId: string
  displayName: string
  role: ConversationRole
  /** createdAt of the last message the participant has read; null when nothing is read yet. */
  lastReadAt: string | null
}

export type Conversation = {
  id: string
  targetType: ChatTargetType
  targetId: string
  targetTitle: string
  status: ConversationStatus
  participants: ConversationParticipant[]
  /** Ready-made backend flag: false makes the conversation read-only. */
  writable: boolean
  unreadCount: number
  lastMessageAt: string | null
  createdAt: string
  /** When the conversation was closed; null while it is not closed. */
  closedAt: string | null
  /**
   * Who closed it by hand. Null on a CLOSED conversation means it was closed
   * automatically (chat off, case closed, response cancelled) and reopens by
   * itself. A participant's id: only they can reopen it. Anyone else: a
   * moderator closed it for good.
   */
  closedBy: string | null
  /** Hidden by the current user. */
  hidden: boolean
}

export type ConversationListParams = {
  targetType?: ChatTargetType
  targetId?: string
  status?: ConversationStatus
  /** Only conversations with these users (at most 100). */
  participantId?: string[]
  /** true: only hidden, false: only visible, unset: all. */
  hidden?: boolean
  page?: number
  size?: number
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  clientMessageId: string
  /** Null on a deleted message. */
  text: string | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export type ChatTyping = {
  conversationId: string
  userId: string
  typing: boolean
}

export type ChatError = {
  conversationId: string
  /** Null only when the server could not read the SEND body. */
  clientMessageId: string | null
  error: string
  /** Localized text for the user. */
  message: string
}
