import type {
  CurrentUser,
  UserProfile,
  EmailChangeDto,
  EmailConfirmationDto,
  AssignmentStatus,
  HelpApplicationStatus,
  MyAssignment,
  MyHelpApplication,
  PageResponse,
  OtpResponse,
  Tokens,
} from "@/types"
import { authorizedRequest } from "./instance"

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ""
}

export const accountApi = {
  getMe: (signal?: AbortSignal) =>
    authorizedRequest<CurrentUser>("/account/me", { signal }),
  logout: () =>
    authorizedRequest<void>(
      "/account/logout",
      { method: "POST" },
      { refreshOnExpired: false },
    ),
  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append("file", file)
    return authorizedRequest<UserProfile>("/account/avatar", {
      method: "PUT",
      body,
    })
  },
  deleteAvatar: () =>
    authorizedRequest<UserProfile>("/account/avatar", { method: "DELETE" }),
  requestEmailChange: (data: EmailChangeDto) =>
    authorizedRequest<OtpResponse>("/account/email/change", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirmEmailChange: (data: EmailConfirmationDto) =>
    authorizedRequest<Tokens>("/account/email/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHelpApplications: (
    status?: HelpApplicationStatus,
    page = 0,
    size = 20,
  ) =>
    authorizedRequest<PageResponse<MyHelpApplication>>(
      `/account/help-applications${query({ status, page, size })}`,
    ),
  getAssignments: (status?: AssignmentStatus, page = 0, size = 20) =>
    authorizedRequest<PageResponse<MyAssignment>>(
      `/account/assignments${query({ status, page, size })}`,
    ),
}
