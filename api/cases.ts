import type {
  AnimalCase,
  UpdateCaseDto,
  AnimalType,
  Assignment,
  CaseDetails,
  CaseListItem,
  CaseNeed,
  CaseNotificationSettings,
  CaseStatus,
  CreateCaseDto,
  HelpApplication,
  NeedStatus,
  PageResponse,
} from "@/types"
import { readTokens } from "@/lib/auth"
import { ApiError, authorizedRequest, request } from "./instance"

type CaseListParams = {
  animalType?: AnimalType
  cityCode?: string
  title?: string
  page?: number
  size?: number
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ""
}

export const casesApi = {
  update: (caseId: string, data: UpdateCaseDto) =>
    authorizedRequest<AnimalCase>(`/cases/${encodeURIComponent(caseId)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  list: (params: CaseListParams = {}, signal?: AbortSignal) =>
    request<PageResponse<CaseListItem>>(`/cases${query(params)}`, { signal }),
  getCases: (params: CaseListParams = {}) => casesApi.list(params),
  /**
   * Public case details. Sent with the access token when signed in so the
   * backend can fill `notificationsEnabled`; falls back to an anonymous
   * request if the session turns out to be invalid.
   */
  getById: async (caseId: string, signal?: AbortSignal) => {
    const path = `/cases/${encodeURIComponent(caseId)}`
    if (!readTokens()) return request<CaseDetails>(path, { signal })
    try {
      return await authorizedRequest<CaseDetails>(path, { signal })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        return request<CaseDetails>(path, { signal })
      throw error
    }
  },
  getCaseById: (caseId: string) => casesApi.getById(caseId),
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
  /** Turns the current participant's email notifications for a case on or off. */
  setNotifications: (caseId: string, enabled: boolean) =>
    authorizedRequest<CaseNotificationSettings>(
      `/cases/${encodeURIComponent(caseId)}/notifications`,
      {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      },
    ),
  addNeed: (caseId: string, type: string) =>
    authorizedRequest<CaseNeed>(`/cases/${encodeURIComponent(caseId)}/needs`, {
      method: "POST",
      body: JSON.stringify({ type }),
    }),
  getNeeds: (caseId: string) =>
    authorizedRequest<CaseNeed[]>(`/cases/${encodeURIComponent(caseId)}/needs`),
  updateNeedStatus: (caseId: string, needId: string, status: NeedStatus) =>
    authorizedRequest<CaseNeed>(
      `/cases/${encodeURIComponent(caseId)}/needs/${encodeURIComponent(needId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    ),
  close: (caseId: string, reason: string, comment?: string) =>
    authorizedRequest<AnimalCase & { status: CaseStatus }>(
      `/cases/${encodeURIComponent(caseId)}/close`,
      {
        method: "POST",
        body: JSON.stringify({ reason, comment: comment || undefined }),
      },
    ),
  closeCase: (caseId: string, reason: string, comment?: string) =>
    casesApi.close(caseId, reason, comment),
  createResponse: (needId: string, message: string) =>
    authorizedRequest<HelpApplication>(
      `/needs/${encodeURIComponent(needId)}/responses`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
    ),
  getResponses: (caseId: string, page = 0, size = 100) =>
    authorizedRequest<PageResponse<HelpApplication>>(
      `/cases/${encodeURIComponent(caseId)}/responses${query({ page, size })}`,
    ),
  cancelResponse: (responseId: string) =>
    authorizedRequest<HelpApplication>(
      `/responses/${encodeURIComponent(responseId)}/cancel`,
      { method: "POST" },
    ),
  assignResponse: (responseId: string) =>
    authorizedRequest<Assignment>(
      `/responses/${encodeURIComponent(responseId)}/assign`,
      { method: "POST" },
    ),
  completeAssignment: (assignmentId: string) =>
    authorizedRequest<Assignment>(
      `/assignments/${encodeURIComponent(assignmentId)}/complete`,
      { method: "POST" },
    ),
}
