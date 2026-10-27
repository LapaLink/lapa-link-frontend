import type {
  AnimalCase,
  UpdateCaseDto,
  Assignment,
  CaseDetails,
  CaseFeedFilter,
  CaseGalleryPhoto,
  CaseListItem,
  CaseMapFilter,
  CaseMapResponse,
  CaseNeed,
  CaseNotificationSettings,
  CaseStatus,
  CreateCaseDto,
  CreateNeedDto,
  HelpApplication,
  NeedStatus,
  PageResponse,
  UpdateNeedDto,
} from "@/types"
import { readTokens } from "@/lib/auth"
import { ApiError, authorizedRequest, request } from "./instance"

function query(
  params: Record<string, string | number | readonly string[] | undefined>,
) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    // Arrays go as a repeated parameter: needType=A&needType=B.
    if (Array.isArray(value))
      value.forEach((item) => item !== "" && search.append(key, item))
    else if (value !== undefined && value !== "") search.set(key, String(value))
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
  /** Public feed. Empty strings and undefined are not sent; there is no `sort` (use `orderBy`). */
  list: (params: CaseFeedFilter = {}, signal?: AbortSignal) =>
    request<PageResponse<CaseListItem>>(`/cases${query(params)}`, { signal }),
  getCases: (params: CaseFeedFilter = {}) => casesApi.list(params),
  /**
   * Feed of cases with an OPEN need matching the user's active help offers:
   * within their radius of the home point, or in the profile city without one.
   */
  matching: (params: CaseFeedFilter = {}, signal?: AbortSignal) =>
    authorizedRequest<PageResponse<CaseListItem>>(
      `/account/help-offers/matching-cases${query(params)}`,
      { signal },
    ),
  /** Public map markers of the visible area with the feed filters. */
  map: (params: CaseMapFilter, signal?: AbortSignal) =>
    request<CaseMapResponse>(`/cases/map${query(params)}`, { signal }),
  /** Map markers of the "Подходит мне" feed. */
  matchingMap: (params: CaseMapFilter, signal?: AbortSignal) =>
    authorizedRequest<CaseMapResponse>(
      `/account/help-offers/matching-cases/map${query(params)}`,
      { signal },
    ),
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
  /**
   * Creates a case; photos go to the gallery in this order, the first is the
   * cover. Atomic: one rejected file and nothing is created. The response has
   * no gallery, load the details for photo ids.
   */
  create: (data: CreateCaseDto, photos: readonly File[] = []) => {
    if (!photos.length)
      return authorizedRequest<AnimalCase>("/cases", {
        method: "POST",
        body: JSON.stringify(data),
      })
    const body = new FormData()
    // The `case` part must be application/json, hence the Blob.
    body.append(
      "case",
      new Blob([JSON.stringify(data)], { type: "application/json" }),
    )
    photos.forEach((photo) => body.append("photos", photo))
    return authorizedRequest<AnimalCase>("/cases", { method: "POST", body })
  },
  /** Appends photos to the end of the gallery (all or none); returns the whole gallery. */
  addPhotos: (caseId: string, photos: readonly File[]) => {
    const body = new FormData()
    photos.forEach((photo) => body.append("photos", photo))
    return authorizedRequest<CaseGalleryPhoto[]>(
      `/cases/${encodeURIComponent(caseId)}/photos`,
      { method: "POST", body },
    )
  },
  /** Removes a photo; the next one becomes the cover if needed. Returns the whole gallery. */
  deletePhoto: (caseId: string, photoId: string) =>
    authorizedRequest<CaseGalleryPhoto[]>(
      `/cases/${encodeURIComponent(caseId)}/photos/${encodeURIComponent(photoId)}`,
      { method: "DELETE" },
    ),
  /**
   * Sets the gallery order; the first photo becomes the cover. `photoIds`
   * must list every photo exactly once (else INVALID_CASE_PHOTO_ORDER).
   */
  reorderPhotos: (caseId: string, photoIds: readonly string[]) =>
    authorizedRequest<CaseGalleryPhoto[]>(
      `/cases/${encodeURIComponent(caseId)}/photos/order`,
      { method: "PATCH", body: JSON.stringify({ photoIds }) },
    ),
  /** Turns the current participant's email notifications for a case on or off. */
  setNotifications: (caseId: string, enabled: boolean) =>
    authorizedRequest<CaseNotificationSettings>(
      `/cases/${encodeURIComponent(caseId)}/notifications`,
      {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      },
    ),
  /** Adds a need; only the type is required, priority defaults to MEDIUM on the server. */
  addNeed: (
    caseId: string,
    type: string,
    details: Omit<CreateNeedDto, "type"> = {},
  ) =>
    authorizedRequest<CaseNeed>(`/cases/${encodeURIComponent(caseId)}/needs`, {
      method: "POST",
      body: JSON.stringify({ type, ...details }),
    }),
  getNeeds: (caseId: string) =>
    authorizedRequest<CaseNeed[]>(`/cases/${encodeURIComponent(caseId)}/needs`),
  /**
   * Partially updates a need: send only changed fields. A closed need cannot
   * be changed (NEED_CLOSED) and status ASSIGNED is not accepted.
   */
  updateNeed: (caseId: string, needId: string, data: UpdateNeedDto) =>
    authorizedRequest<CaseNeed>(
      `/cases/${encodeURIComponent(caseId)}/needs/${encodeURIComponent(needId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),
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
  updateResponse: (responseId: string, message: string) =>
    authorizedRequest<HelpApplication>(
      `/responses/${encodeURIComponent(responseId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ message }),
      },
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
