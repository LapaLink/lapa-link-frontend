/** CONVERSATION: the last 200 messages are saved for the moderator when it is sent. */
export type ComplaintTargetType = "CASE" | "USER" | "CONVERSATION"
export type ComplaintStatus = "NEW" | "IN_PROGRESS" | "REJECTED" | "RESOLVED"

export type CreateComplaintDto = {
  targetType: ComplaintTargetType
  targetId: string
  /** 1..1000 characters. */
  message: string
}

export type Complaint = {
  id: string
  targetType: ComplaintTargetType
  targetId: string
  message: string
  status: ComplaintStatus
  createdAt: string
  updatedAt: string
}
