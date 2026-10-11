"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { inboxApi } from "@/api"
import { getSessionRevision, readTokens } from "@/lib/auth"
import { queryKeys } from "@/lib/queryKeys"
import type { NotificationChannelSetting } from "@/types"

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: ({ signal }) => inboxApi.unreadCount(signal),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

export function useInbox(page: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inboxPage(page),
    queryFn: ({ signal }) => inboxApi.list(page, 10, signal),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })
}

export function useReadNotifications() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.inbox })
  return useMutation({
    mutationFn: async (id: string | null) => {
      const revision = getSessionRevision()
      if (id) await inboxApi.read(id)
      else await inboxApi.readAll()
      if (revision === getSessionRevision() && readTokens()) await refresh()
    },
  })
}

export function useNotificationChannels() {
  return useQuery({
    queryKey: queryKeys.notificationChannels,
    queryFn: ({ signal }) => inboxApi.channels(signal),
  })
}

export function useUpdateNotificationChannel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (setting: NotificationChannelSetting) => {
      const revision = getSessionRevision()
      const updated = await inboxApi.updateChannel(setting)
      if (revision === getSessionRevision() && readTokens()) {
        client.setQueryData<NotificationChannelSetting[]>(
          queryKeys.notificationChannels,
          (current) =>
            current?.map((item) =>
              item.channel === updated.channel ? updated : item,
            ),
        )
      }
      return updated
    },
  })
}
