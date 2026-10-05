import type { AnimalCase, CaseNeed, CreateCaseDto } from "@/types"
import { authorizedRequest } from "./instance"

export const casesApi = {
  create: (data: CreateCaseDto, photo?: File) => {
    if (!photo)
      return authorizedRequest<AnimalCase>("/cases", {
        method: "POST",
        body: JSON.stringify(data),
      })
    const body = new FormData()
    body.append(
      "case",
      new Blob([JSON.stringify(data)], { type: "application/json" }),
    )
    body.append("photo", photo)
    return authorizedRequest<AnimalCase>("/cases", { method: "POST", body })
  },
  addNeed: (caseId: string, type: string) =>
    authorizedRequest<CaseNeed>(`/cases/${encodeURIComponent(caseId)}/needs`, {
      method: "POST",
      body: JSON.stringify({ type }),
    }),
  getNeeds: (caseId: string) =>
    authorizedRequest<CaseNeed[]>(`/cases/${encodeURIComponent(caseId)}/needs`),
}
