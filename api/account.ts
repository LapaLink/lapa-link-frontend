import type {
  AccountDeletionDto,
  CurrentUser,
  UpdateProfileDto,
  MyCaseListItem,
  UserProfile,
  EmailChangeDto,
  EmailConfirmationDto,
  NotificationSetting,
  PasswordChangeDto,
  UserLocale,
  AssignmentStatus,
  CaseStatus,
  CreateHelpOfferDto,
  HelpApplicationStatus,
  HelpOffer,
  MyAssignment,
  MyHelpApplication,
  PageResponse,
  OtpResponse,
  Tokens,
  UpdateHelpOfferDto,
} from "@/types"
import { getSessionRevision } from "@/lib/auth"
import { authorizedRequest, setRequestLocale } from "./instance"

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value))
  })
  const value = search.toString()
  return value ? `?${value}` : ""
}

export const accountApi = {
  updateProfile: (data: UpdateProfileDto) =>
    authorizedRequest<CurrentUser>("/account/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Own cases, drafts included; `status` narrows the list (e.g. DRAFT). */
  getCases: (
    page = 0,
    size = 20,
    signal?: AbortSignal,
    status?: CaseStatus,
  ) =>
    authorizedRequest<PageResponse<MyCaseListItem>>(
      `/account/cases${query({ status, page, size })}`,
      { signal },
    ),
  getMe: async (signal?: AbortSignal) => {
    const revision = getSessionRevision()
    const user = await authorizedRequest<CurrentUser>("/account/me", { signal })
    setRequestLocale(user.locale, revision)
    return user
  },
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
  /** Returns a new token pair; the previous session is revoked. */
  changePassword: (data: PasswordChangeDto) =>
    authorizedRequest<Tokens>("/account/password/change", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Permanently deletes the account; on 204 the server has revoked every session. */
  deleteAccount: (data: AccountDeletionDto) =>
    authorizedRequest<void>("/account/delete", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLocale: async (locale: UserLocale) => {
    const revision = getSessionRevision()
    await authorizedRequest<void>("/account/locale", {
      method: "PUT",
      body: JSON.stringify({ locale }),
    })
    setRequestLocale(locale, revision)
  },
  /** Configurable notifications only; mandatory and per-case events are not listed. */
  getNotifications: (signal?: AbortSignal) =>
    authorizedRequest<NotificationSetting[]>("/account/notifications", {
      signal,
    }),
  updateNotification: ({ eventType, channel, enabled }: NotificationSetting) =>
    authorizedRequest<NotificationSetting>(
      `/account/notifications/${encodeURIComponent(eventType)}/${encodeURIComponent(channel)}`,
      {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      },
    ),
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
  /** Kinds of help the user is ready to give, disabled ones included, oldest first. */
  getHelpOffers: (signal?: AbortSignal) =>
    authorizedRequest<HelpOffer[]>("/account/help-offers", { signal }),
  /** One offer per need type; a duplicate fails with HELP_OFFER_ALREADY_EXISTS. */
  createHelpOffer: (data: CreateHelpOfferDto) =>
    authorizedRequest<HelpOffer>("/account/help-offers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Partial update; the type cannot be changed. */
  updateHelpOffer: (offerId: string, data: UpdateHelpOfferDto) =>
    authorizedRequest<HelpOffer>(
      `/account/help-offers/${encodeURIComponent(offerId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    ),
  deleteHelpOffer: (offerId: string) =>
    authorizedRequest<void>(
      `/account/help-offers/${encodeURIComponent(offerId)}`,
      { method: "DELETE" },
    ),
}
