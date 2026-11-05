/**
 * Active: NEW, CONTACTED, MEETING, APPROVED. Final: REJECTED (author) and
 * CANCELLED (applicant). APPROVED does not close the case.
 */
export type AdoptionRequestStatus =
  "NEW" | "CONTACTED" | "MEETING" | "APPROVED" | "REJECTED" | "CANCELLED"

export type HousingType =
  "OWN_APARTMENT" | "RENTED_APARTMENT" | "OWN_HOUSE" | "OTHER"
export type OwnerConsent = "YES" | "NO" | "NOT_REQUIRED"
export type PetExperience = "HAD_DOGS" | "HAD_CATS" | "HAD_OTHER" | "FIRST_PET"
export type PetsHealthStatus = "YES" | "NO" | "PARTIALLY"
export type TravelPlan =
  "RELATIVES_OR_FRIENDS" | "PET_HOTEL" | "TAKE_WITH_ME" | "NOT_DECIDED"

/** The base questionnaire sent with a request; every field is required. */
export type AdoptionQuestionnaire = {
  housingType: HousingType
  /** NOT_REQUIRED unless the housing is rented. */
  ownerConsent: OwnerConsent
  familyAgreement: boolean
  hasYoungChildren: boolean
  petExperience: PetExperience
  hasCurrentPets: boolean
  /** Up to 300 characters; required when hasCurrentPets. */
  currentPetsDetails?: string
  /** Required when hasCurrentPets. */
  currentPetsHealthStatus?: PetsHealthStatus
  travelPlan: TravelPlan
  readyForSterilization: boolean
}

/** A question the author asked by phone or chat, with the recorded answer. */
export type CuratorAnswer = { question: string; answer: string }

/** A request to take the animal home, for a case with an ADOPTION need. */
export type AdoptionRequest = {
  id: string
  animalCase: { id: string; title: string; photoUrl: string | null }
  applicant: { id: string; displayName: string }
  message: string
  /**
   * Flat object: questionnaire keys with scalar values, plus `curator_<epoch
   * millis>` keys holding a CuratorAnswer.
   */
  answers?: Record<string, unknown>
  status: AdoptionRequestStatus
  createdAt: string
  updatedAt: string
}
