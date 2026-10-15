import type {
  AssignmentStatus,
  CaseListItem,
  CaseNeed,
  HelpApplicationStatus,
} from "./cases"

export type UpdateProfileDto = {
  displayName: string
  cityCode: string | null
  bio: string | null
}

export type UserProfile = {
  userId: string
  cityCode: string | null
  bio: string | null
  avatarUrl: string | null
  updatedAt: string
}

export type EmailChangeDto = {
  newEmail: string
  password: string
}

export type PasswordChangeDto = {
  currentPassword: string
  newPassword: string
}

export type AccountDeletionDto = {
  password: string
}

export type UserLocale = "ru" | "be"

export type NotificationSetting = {
  eventType: string
  channel: string
  enabled: boolean
}

export type EmailConfirmationDto = {
  requestId: string
  code: string
}

export type AccountCaseSummary = {
  id: string
  title: string
  animalType: CaseListItem["animalType"]
  cityCode: string | null
  photoUrl?: string | null
  createdAt: string
}

export type MyHelpApplication = {
  id: string
  status: HelpApplicationStatus
  message: string
  need: CaseNeed
  animalCase: AccountCaseSummary
  createdAt: string
}

export type MyAssignment = {
  id: string
  status: AssignmentStatus
  need: CaseNeed
  animalCase: AccountCaseSummary
  createdAt: string
  updatedAt: string
}

export type HelpOffer = {
  id: string
  /** Need type code from /need-types. */
  type: string
  /** 1..100 km from the profile home zone. */
  radiusKm: number
  availability: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type CreateHelpOfferDto = {
  type: string
  radiusKm: number
  availability?: string
}

/** Partial update: a missing field is left as is, an empty availability clears it. */
export type UpdateHelpOfferDto = Partial<{
  radiusKm: number
  availability: string
  active: boolean
}>
