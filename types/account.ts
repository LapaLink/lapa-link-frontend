import type {
  AssignmentStatus,
  CaseListItem,
  CaseNeed,
  HelpApplicationStatus,
} from "./cases"

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
