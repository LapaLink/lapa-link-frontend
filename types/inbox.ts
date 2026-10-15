export type InboxNotification = {
  id: string
  eventType: string
  title: string
  message: string
  read: boolean
  readAt: string | null
  createdAt: string
  caseId: string | null
  needId: string | null
  responseId: string | null
  assignmentId: string | null
  actionUrl: string | null
}

export type NotificationChannelSetting = {
  channel: "EMAIL" | "IN_APP"
  /** Channel name translated to the session language. */
  title: string
  enabled: boolean
}
