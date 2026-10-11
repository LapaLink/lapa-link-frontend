import type {
  InboxNotification,
  NotificationChannelSetting,
  PageResponse,
} from "@/types"
import { authorizedRequest } from "./instance"

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
  channels: (signal?: AbortSignal) =>
    authorizedRequest<NotificationChannelSetting[]>(
      "/account/notification-channels",
      { signal },
    ),
  updateChannel: ({ channel, enabled }: NotificationChannelSetting) =>
    authorizedRequest<NotificationChannelSetting>(
      `/account/notification-channels/${channel}`,
      { method: "PUT", body: JSON.stringify({ enabled }) },
    ),
}
