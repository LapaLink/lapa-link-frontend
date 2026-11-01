import type {
  ModerationAction,
  ModerationFilter,
  ModerationReport,
  ModerationTarget,
  PageResponse,
} from "@/types"
import { authorizedRequest } from "./instance"

const reportPath = (id: string) => `/admin/complaints/${encodeURIComponent(id)}`

export const moderationApi = {
  list: (
    { page, status, targetType }: ModerationFilter,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ page: String(page), size: "20" })
    if (status) params.set("status", status)
    if (targetType) params.set("targetType", targetType)
    return authorizedRequest<PageResponse<ModerationReport>>(
      `/admin/complaints?${params}`,
      { signal },
    )
  },
  report: (id: string, signal?: AbortSignal) =>
    authorizedRequest<ModerationReport>(reportPath(id), { signal }),
  // The complaint-scoped snapshot is the only source of chat content here.
  target: (id: string, signal?: AbortSignal) =>
    authorizedRequest<ModerationTarget>(`${reportPath(id)}/target`, { signal }),
  act: (id: string, action: ModerationAction, comment?: string) =>
    authorizedRequest<ModerationReport>(`${reportPath(id)}/${action}`, {
      method: "POST",
      ...(action === "take" ? {} : { body: JSON.stringify({ comment }) }),
    }),
  blockUser: (id: string, reason: string) =>
    authorizedRequest<unknown>(`/admin/users/${encodeURIComponent(id)}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
}
