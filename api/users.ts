import type { PublicProfile } from "@/types"
import { authorizedRequest } from "./instance"

export const usersApi = {
  /** Public profile; 404 USER_NOT_FOUND for a missing, deleted or inactive user. */
  get: (userId: string, signal?: AbortSignal) =>
    authorizedRequest<PublicProfile>(`/users/${encodeURIComponent(userId)}`, {
      signal,
    }),
}
