export type ChatTargetType = "CASE"
export type ConversationStatus = "REQUESTED" | "ACTIVE" | "DECLINED"
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
}

export type ConversationListParams = {
  targetType?: ChatTargetType
  targetId?: string
  status?: ConversationStatus
  /** Only conversations with these users (at most 100). */
  participantId?: string[]
  page?: number
  size?: number
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  clientMessageId: string
  text: string
  createdAt: string
}

export type ChatError = {
  conversationId: string
  /** Null only when the server could not read the SEND body. */
  clientMessageId: string | null
  error: string
  /** Localized text for the user. */
  message: string
}
