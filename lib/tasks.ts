import type { MyAssignment, MyHelpApplication } from "@/types"

export type MyTaskGroupKey = "pending" | "active" | "completed" | "cancelled"

export type MyTaskItem = {
  id: string
  needId: string
  caseId: string
  title: string
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED"
  type: "response" | "assignment"
  createdAt: string
  updatedAt?: string
  message?: string
  needType: string
}

type TaskRecordWithLinks = {
  need?: { id?: string; type?: string }
  animalCase?: { id?: string; title?: string }
}

export function filterValidTaskRecords<T extends TaskRecordWithLinks>(
  items: T[] = [],
) {
  return items.filter((item): item is T => {
    const needId = item?.need?.id
    const caseId = item?.animalCase?.id
    return typeof needId === "string" && typeof caseId === "string"
  })
}

export function buildMyTaskGroups(
  applications: MyHelpApplication[] = [],
  assignments: MyAssignment[] = [],
) {
  const map = new Map<string, MyTaskItem>()
  const safeApplications = filterValidTaskRecords(applications)
  const safeAssignments = filterValidTaskRecords(assignments)

  for (const application of safeApplications) {
    const key = application.need.id
    const existing = map.get(key)
    if (application.status === "ACCEPTED" || application.status === "PENDING") {
      if (application.status === "ACCEPTED") {
        const assignmentMatch = safeAssignments.find(
          (item) => item.need.id === key && item.status === "ACTIVE",
        )
        if (assignmentMatch) continue
      }
      map.set(key, {
        id: application.id,
        needId: application.need.id,
        caseId: application.animalCase.id,
        title: application.animalCase.title,
        status: application.status === "PENDING" ? "PENDING" : "CANCELLED",
        type: "response",
        createdAt: application.createdAt,
        message: application.message,
        needType: application.need.type,
      })
      continue
    }

    if (!existing) {
      map.set(key, {
        id: application.id,
        needId: application.need.id,
        caseId: application.animalCase.id,
        title: application.animalCase.title,
        status: "CANCELLED",
        type: "response",
        createdAt: application.createdAt,
        message: application.message,
        needType: application.need.type,
      })
    }
  }

  for (const assignment of safeAssignments) {
    const key = assignment.need.id
    const existing = map.get(key)

    if (assignment.status === "ACTIVE") {
      map.set(key, {
        id: assignment.id,
        needId: assignment.need.id,
        caseId: assignment.animalCase.id,
        title: assignment.animalCase.title,
        status: "ACTIVE",
        type: "assignment",
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        needType: assignment.need.type,
      })
      continue
    }

    if (assignment.status === "COMPLETED") {
      map.set(key, {
        id: assignment.id,
        needId: assignment.need.id,
        caseId: assignment.animalCase.id,
        title: assignment.animalCase.title,
        status: "COMPLETED",
        type: "assignment",
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        needType: assignment.need.type,
      })
      continue
    }

    if (!existing) {
      map.set(key, {
        id: assignment.id,
        needId: assignment.need.id,
        caseId: assignment.animalCase.id,
        title: assignment.animalCase.title,
        status: "CANCELLED",
        type: "assignment",
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        needType: assignment.need.type,
      })
    }
  }

  const items = Array.from(map.values())

  return {
    pending: items.filter((item) => item.status === "PENDING"),
    active: items.filter((item) => item.status === "ACTIVE"),
    completed: items.filter((item) => item.status === "COMPLETED"),
    cancelled: items.filter((item) => item.status === "CANCELLED"),
  }
}
