"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth, startInboxStream } from "@/hooks"
import { inboxApi, getErrorMessage } from "@/api"
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth"
import { inboxItemHref, prependNotification } from "@/lib/inbox"
import type { InboxNotification, PageResponse } from "@/types"
import { invalidateChatData, queryKeys } from "@/lib/queryKeys"

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  )
  return (
    <>
      {user && <Connection key={`${session}:${user.id}`} session={session} />}
      {children}
    </>
  )
}

function Connection({ session }: { session: string }) {
  const client = useQueryClient()
  const router = useRouter()
  useEffect(() => {
    const current = () => getSessionSnapshot() === session
    const stop = startInboxStream({
      isCurrent: current,
      onConnected: () => {
        void client.invalidateQueries({ queryKey: queryKeys.inbox })
        void client
          .fetchQuery({
            queryKey: queryKeys.unreadCount,
            queryFn: ({ signal }) => inboxApi.unreadCount(signal),
            staleTime: 0,
          })
          .catch(() => {})
        void client
          .fetchQuery({
            queryKey: queryKeys.inboxPage(0),
            queryFn: ({ signal }) => inboxApi.list(0, 10, signal),
            staleTime: 0,
          })
          .catch(() => {})
      },
      onCount: (count) => {
        void client
          .cancelQueries({ queryKey: queryKeys.unreadCount })
          .then(() => {
            if (current()) client.setQueryData(queryKeys.unreadCount, { count })
          })
        void client.invalidateQueries({
          queryKey: [...queryKeys.inbox, "list"],
        })
      },
      onNotification: (item) => {
        client.setQueryData<PageResponse<InboxNotification>>(
          queryKeys.inboxPage(0),
          (page) => prependNotification(page, item),
        )
        void client.invalidateQueries({
          queryKey: [...queryKeys.inbox, "list"],
        })
        if (item.caseId) {
          void client.invalidateQueries({
            queryKey: queryKeys.caseDetail(item.caseId),
          })
          void client.invalidateQueries({
            queryKey: queryKeys.caseResponses(item.caseId),
          })
          void client.invalidateQueries({ queryKey: ["account", "cases"] })
          void client.invalidateQueries({ queryKey: queryKeys.casesList })
        }
        void client.invalidateQueries({ queryKey: ["account", "applications"] })
        void client.invalidateQueries({ queryKey: ["account", "assignments"] })
        if (item.eventType.startsWith("CHAT_")) void invalidateChatData(client)
        const href = inboxItemHref(item)
        toast(item.title, {
          id: item.id,
          description: item.message,
          ...(href
            ? {
                action: {
                  label: "Посмотреть",
                  onClick: () => {
                    if (!current()) return
                    void inboxApi
                      .read(item.id)
                      .then(() => {
                        if (!current()) return
                        void client.invalidateQueries({
                          queryKey: queryKeys.inbox,
                        })
                        router.push(href)
                      })
                      .catch((error) => {
                        if (current())
                          toast.error(
                            getErrorMessage(
                              error,
                              "Не удалось открыть уведомление.",
                            ),
                          )
                      })
                  },
                },
              }
            : {}),
        })
      },
    })
    return () => {
      stop()
      toast.dismiss()
      void client.cancelQueries({ queryKey: queryKeys.inbox })
      client.removeQueries({ queryKey: queryKeys.inbox })
    }
  }, [client, router, session])
  return null
}
