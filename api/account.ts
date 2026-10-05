import type {
  CurrentUser,
  UserProfile,
  EmailChangeDto,
  EmailConfirmationDto,
  OtpResponse,
  Tokens,
} from "@/types"
import { authorizedRequest } from "./instance"

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
}
