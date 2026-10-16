export type AnimalType = "CAT" | "DOG"
export type UpdateCaseDto = Partial<{
  title: string | null
  description: string | null
  sex: AnimalSex | null
  approximateAge: string | null
  condition: string | null
  cityCode: string | null
  latitude: number | null
  longitude: number | null
}>

export type MyCaseListItem = Omit<CaseListItem, "cityCode"> & {
  cityCode?: string | null
  status: CaseStatus
  openNeedsCount: number
  applicationsCount: number
}
export type AnimalSex = "MALE" | "FEMALE" | "UNKNOWN"
export type CaseStatus = "OPEN" | "CLOSED"
export type NeedStatus = "OPEN" | "ASSIGNED" | "CLOSED"
export type NeedPriority = "LOW" | "MEDIUM" | "HIGH"

/** Feed order; ties go newest first. DISTANCE needs a point. */
export type CaseFeedSort = "NEWEST" | "DISTANCE" | "PRIORITY"

/**
 * Feed query for GET /cases and /account/help-offers/matching-cases.
 * needType, priority and needStatus apply to the same need of a case.
 * latitude and longitude go together; radiusKm and orderBy=DISTANCE require
 * them, otherwise the backend answers 400 FEED_POINT_REQUIRED.
 */
export type CaseFeedFilter = {
  animalType?: AnimalType
  cityCode?: string
  /** Legacy title-only search; the UI uses `search`. */
  title?: string
  /** Title and description, up to 200 characters. */
  search?: string
  /** Code from /need-types. */
  needType?: string
  priority?: NeedPriority
  needStatus?: NeedStatus
  latitude?: number
  longitude?: number
  /** Integer 1..100. */
  radiusKm?: number
  orderBy?: CaseFeedSort
  page?: number
  size?: number
}
export type HelpApplicationStatus = "PENDING" | "ACCEPTED" | "CANCELLED"
export type AssignmentStatus = "ACTIVE" | "CANCELLED" | "COMPLETED"

export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export type CreateCaseDto = {
  animalType: AnimalType
  title: string
  cityCode: string
  latitude: number
  longitude: number
  description?: string
  sex?: AnimalSex
  approximateAge?: string
  condition?: string
}

export type AnimalCase = CreateCaseDto & {
  id: string
  authorId: string
  sex: AnimalSex
  status: CaseStatus
  photoUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type CaseNeed = {
  id: string
  caseId: string
  type: string
  status: NeedStatus
  priority: NeedPriority
  /** ISO-8601 UTC start of the time window. */
  startsAt: string | null
  /** ISO-8601 UTC deadline. */
  deadline: string | null
  comment: string | null
}

export type CreateNeedDto = {
  type: string
  priority?: NeedPriority
  startsAt?: string
  deadline?: string
  comment?: string
}

/**
 * Partial need update: a missing field is left as is, so a time window bound
 * cannot be cleared; an empty comment clears it.
 */
export type UpdateNeedDto = Partial<{
  status: Exclude<NeedStatus, "ASSIGNED">
  priority: NeedPriority
  startsAt: string
  deadline: string
  comment: string
}>

export type CaseAuthor = {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export type CaseListItem = {
  id: string
  animalType: AnimalType
  title: string
  cityCode: string
  photoUrl?: string | null
  createdAt: string
}

export type CaseDetails = Omit<AnimalCase, "authorId"> & {
  closeReason?: string | null
  closeComment?: string | null
  closedAt?: string | null
  author: CaseAuthor
  needs: CaseNeed[]
  /** Current user's email notifications for this case; null when not a participant or anonymous. */
  notificationsEnabled?: boolean | null
}

export type CaseNotificationSettings = {
  caseId: string
  enabled: boolean
}

export type Applicant = {
  id: string
  displayName: string | null
}

export type HelpApplication = {
  id: string
  needId: string
  message: string
  status: HelpApplicationStatus
  user: Applicant
  createdAt: string
}

export type Assignment = {
  id: string
  status: AssignmentStatus
  need: CaseNeed
  application: HelpApplication
  createdAt: string
}
