import type { Complaint, ComplaintTargetType } from "./complaints"

export type ModerationReport = Complaint & {
  reporterId: string
  resolution: string | null
  moderatorComment: string | null
  moderatedBy: string | null
  moderatedAt: string | null
}

export type ModerationTarget =
  | {
      type: "CASE"
      caseId: string
      authorId: string
      title: string
      description: string
      status: string
      closedAt: string | null
    }
  | { type: "USER"; userId: string; displayName: string | null; status: string }
  | {
      type: "CONVERSATION"
      conversationId: string
      chatTitle: string | null
      chatTargetType: string | null
      chatTargetId: string | null
      participantIds: string[]
      messages: {
        messageId: string
        senderId: string
        text: string | null
        createdAt: string
        editedAt: string | null
        deletedAt: string | null
      }[]
    }

export type ModerationFilter = {
  page: number
  status?: Complaint["status"]
  targetType?: ComplaintTargetType
}
export type ModerationAction =
  "take" | "reject" | "warn" | "hide-target" | "close-target"
