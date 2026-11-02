export type SupportQuestionStatus = "NEW" | "IN_PROGRESS" | "CLOSED"

/** A question to the administration; its chat has targetId = id. */
export type SupportQuestion = {
  id: string
  /** Null once the closed chat is deleted (14 days after closing). */
  conversationId: string | null
  message: string
  status: SupportQuestionStatus
  takenAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}
