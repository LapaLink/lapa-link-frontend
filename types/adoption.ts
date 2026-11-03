/**
 * Active: NEW, CONTACTED, MEETING, APPROVED. Final: REJECTED (author) and
 * CANCELLED (applicant). APPROVED does not close the case.
 */
export type AdoptionRequestStatus =
  "NEW" | "CONTACTED" | "MEETING" | "APPROVED" | "REJECTED" | "CANCELLED"

/** A request to take the animal home, for a case with an ADOPTION need. */
export type AdoptionRequest = {
  id: string
  animalCase: { id: string; title: string; photoUrl: string | null }
  applicant: { id: string; displayName: string }
  message: string
  status: AdoptionRequestStatus
  createdAt: string
  updatedAt: string
}
