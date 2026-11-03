import type {
  AdoptionRequest,
  AdoptionRequestStatus,
  PageResponse,
} from "@/types"
import { authorizedRequest } from "./instance"

const page = (
  status: AdoptionRequestStatus | undefined,
  p: number,
  size: number,
) =>
  `?${new URLSearchParams({ ...(status && { status }), page: String(p), size: String(size) })}`

export const adoptionApi = {
  /** Applies for a case with an open ADOPTION need (message 1..1000). */
  create: (caseId: string, message: string) =>
    authorizedRequest<AdoptionRequest>(
      `/cases/${encodeURIComponent(caseId)}/adoption-requests`,
      { method: "POST", body: JSON.stringify({ message }) },
    ),
  /** Own requests, newest first. */
  my: (
    status?: AdoptionRequestStatus,
    p = 0,
    size = 20,
    signal?: AbortSignal,
  ) =>
    authorizedRequest<PageResponse<AdoptionRequest>>(
      `/account/adoption-requests${page(status, p, size)}`,
      { signal },
    ),
  /** The applicant withdraws an active request. */
  cancel: (requestId: string) =>
    authorizedRequest<AdoptionRequest>(
      `/adoption-requests/${encodeURIComponent(requestId)}/cancel`,
      { method: "POST" },
    ),
  /** Requests for the author's case, oldest first. */
  forCase: (
    caseId: string,
    status?: AdoptionRequestStatus,
    p = 0,
    size = 100,
    signal?: AbortSignal,
  ) =>
    authorizedRequest<PageResponse<AdoptionRequest>>(
      `/cases/${encodeURIComponent(caseId)}/adoption-requests${page(status, p, size)}`,
      { signal },
    ),
  /** The author moves a request forward or rejects it. */
  setStatus: (requestId: string, status: AdoptionRequestStatus) =>
    authorizedRequest<AdoptionRequest>(
      `/adoption-requests/${encodeURIComponent(requestId)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
}
