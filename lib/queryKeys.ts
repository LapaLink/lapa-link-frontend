import type { QueryClient } from "@tanstack/react-query"
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"

export const queryKeys = {
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
