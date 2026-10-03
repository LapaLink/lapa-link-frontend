import type { CurrentUser } from "@/types"
import { authorizedRequest } from "./instance"

export const accountApi = {
  getMe: (signal?: AbortSignal) =>
    authorizedRequest<CurrentUser>("/account/me", { signal }),
  logout: () => authorizedRequest<void>("/account/logout", { method: "POST" }),
}
