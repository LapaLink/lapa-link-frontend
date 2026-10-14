import type { QueryClient } from "@tanstack/react-query"
import type {
  AssignmentStatus,
  ConversationListParams,
  HelpApplicationStatus,
} from "@/types"

export const queryKeys = {
  inbox: ["account", "inbox"] as const,
  inboxPage: (page = 0) => ["account", "inbox", "list", page] as const,
  unreadCount: ["account", "inbox", "unread-count"] as const,
  notificationChannels: ["account", "notification-channels"] as const,
  myCases: (page = 0, size = 20) =>
    ["account", "cases", { page, size }] as const,
  casesList: ["cases", "list"] as const,
  caseDetail: (id: string) => ["cases", "detail", id] as const,
  caseResponses: (id: string) => ["cases", "responses", id] as const,
  myApplications: (status?: HelpApplicationStatus) =>
    ["account", "applications", status ?? "ALL"] as const,
  myAssignments: (status?: AssignmentStatus) =>
    ["account", "assignments", status ?? "ALL"] as const,
  notifications: ["account", "notifications"] as const,
  chat: ["chat"] as const,
  chatPermission: (targetType: string, targetId: string) =>
    ["chat", "permission", targetType, targetId] as const,
  conversationLists: ["chat", "conversations"] as const,
  conversations: (params: ConversationListParams = {}) =>
    ["chat", "conversations", params] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
  chatMessages: (id: string) => ["chat", "messages", id] as const,
  chatUnreadCount: ["chat", "unread-count"] as const,
}

export async function invalidateCaseData(client: QueryClient, caseId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.caseDetail(caseId) }),
    client.invalidateQueries({ queryKey: ["account", "cases"] }),
    client.invalidateQueries({ queryKey: queryKeys.casesList }),
  ])
}

export async function invalidateTaskData(client: QueryClient, caseId?: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["account"] }),
    client.invalidateQueries({ queryKey: ["cases"] }),
    ...(caseId
      ? [client.invalidateQueries({ queryKey: queryKeys.caseDetail(caseId) })]
      : []),
  ])
}

/**
 * Refreshes chat permissions and conversations. Message history is kept:
 * the socket keeps it current and a refetch would drop unsent messages.
 */
export function invalidateChatData(client: QueryClient) {
  return client.invalidateQueries({
    queryKey: queryKeys.chat,
    predicate: (query) => query.queryKey[1] !== "messages",
  })
}
