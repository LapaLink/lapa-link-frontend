import type { QueryClient } from "@tanstack/react-query"
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"

export const queryKeys = {
  casesList: ["cases", "list"] as const,
  caseDetail: (id: string) => ["cases", "detail", id] as const,
  caseResponses: (id: string) => ["cases", "responses", id] as const,
  myApplications: (status?: HelpApplicationStatus) =>
    ["account", "applications", status ?? "ALL"] as const,
  myAssignments: (status?: AssignmentStatus) =>
    ["account", "assignments", status ?? "ALL"] as const,
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
