import type { AdoptionRequestStatus } from "@/types"

export const ADOPTION_NEED_TYPE = "ADOPTION"
export const ADOPTION_MESSAGE_MAX = 1000

const ACTIVE: readonly string[] = ["NEW", "CONTACTED", "MEETING", "APPROVED"]
// The author moves a request only forward; steps may be skipped.
const FORWARD = ["NEW", "CONTACTED", "MEETING", "APPROVED"] as const

/** True while the request is not REJECTED or CANCELLED. */
export function isActiveAdoption(status: string) {
  return ACTIVE.includes(status)
}

/** Status label; NEW reads «На рассмотрении» to the applicant. Unknown: raw. */
export function adoptionStatusLabel(status: string, forApplicant = false) {
  const labels: Record<AdoptionRequestStatus, string> = {
    NEW: forApplicant ? "На рассмотрении" : "Новая",
    CONTACTED: "Связались",
    MEETING: "Встреча назначена",
    APPROVED: "Одобрена",
    REJECTED: "Отклонена",
    CANCELLED: "Отозвана",
  }
  return labels[status as AdoptionRequestStatus] ?? status
}

/** Statuses the author may set next: later forward steps, then REJECTED. */
export function nextAdoptionStatuses(status: string): AdoptionRequestStatus[] {
  if (!isActiveAdoption(status)) return []
  const index = FORWARD.indexOf(status as (typeof FORWARD)[number])
  return [...FORWARD.slice(index + 1), "REJECTED"]
}
