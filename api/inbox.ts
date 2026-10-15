import type {
  InboxNotification,
  NotificationChannelSetting,
  PageResponse,
} from "@/types"
import { authorizedRequest } from "./instance"

/** Quiet hours may come as "22:00" or "22:00:00"; the UI works with "HH:mm". */
const withShortTimes = (
  setting: NotificationChannelSetting,
): NotificationChannelSetting => ({
  ...setting,
  quietFrom: setting.quietFrom?.slice(0, 5) ?? null,
  quietTo: setting.quietTo?.slice(0, 5) ?? null,
})

export const inboxApi = {
  list: (page = 0, size = 10, signal?: AbortSignal) =>
    authorizedRequest<PageResponse<InboxNotification>>(
      `/account/inbox?page=${page}&size=${size}`,
      { signal },
    ),
  unreadCount: (signal?: AbortSignal) =>
    authorizedRequest<{ count: number }>("/account/inbox/unread-count", {
      signal,
    }),
  read: (id: string) =>
    authorizedRequest<InboxNotification>(
      `/account/inbox/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    ),
  readAll: () =>
    authorizedRequest<void>("/account/inbox/read-all", { method: "POST" }),
  stream: (signal: AbortSignal) =>
    authorizedRequest<Response>(
      "/account/inbox/stream",
      { signal, headers: { Accept: "text/event-stream" } },
      { stream: true },
    ),
  channels: async (signal?: AbortSignal) =>
    (
      await authorizedRequest<NotificationChannelSetting[]>(
        "/account/notification-channels",
        { signal },
      )
    ).map(withShortTimes),
  /**
   * Replaces the whole channel setting: send the current quiet hours too, or
   * they are cleared. Quiet hours are EMAIL only and must be null for IN_APP.
   */
  updateChannel: async ({
    channel,
    enabled,
    quietFrom,
    quietTo,
  }: Omit<NotificationChannelSetting, "title">) =>
    withShortTimes(
      await authorizedRequest<NotificationChannelSetting>(
        `/account/notification-channels/${channel}`,
        {
          method: "PUT",
          body: JSON.stringify({ enabled, quietFrom, quietTo }),
        },
      ),
    ),
}
