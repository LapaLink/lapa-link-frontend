export type AnimalType = "CAT" | "DOG"
export type AnimalSex = "MALE" | "FEMALE" | "UNKNOWN"

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
  status: "OPEN" | "CLOSED"
  photoUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type CaseNeed = {
  id: string
  caseId: string
  type: string
  status: "OPEN" | "CLOSED"
}
