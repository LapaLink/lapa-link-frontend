export type AnimalType = "CAT" | "DOG"
export type AnimalSex = "MALE" | "FEMALE" | "UNKNOWN"
export type CaseStatus = "OPEN" | "CLOSED"
export type NeedStatus = "OPEN" | "ASSIGNED" | "CLOSED"
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
}

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
