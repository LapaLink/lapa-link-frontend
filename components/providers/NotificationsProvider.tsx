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
import {
  enqueueMandatory,
  inboxItemHref,
  navigateToInboxItem,
  prependNotification,
} from "@/lib/inbox"
import type { InboxNotification, PageResponse } from "@/types"
import { invalidateChatData, queryKeys } from "@/lib/queryKeys"
import { MandatoryNotifications } from "@/components/common"

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
        // Mandatory ones wait in the modal queue; the same id may also come
        // from GET /inbox/mandatory, the queue dedupes by id.
        if (item.mandatory && !item.read)
          client.setQueryData<InboxNotification[]>(
            queryKeys.inboxMandatory,
            (queue) => enqueueMandatory(queue, item),
          )
        if (item.caseId) {
          void client.invalidateQueries({
            queryKey: queryKeys.caseDetail(item.caseId),
          })
          void client.invalidateQueries({
            queryKey: queryKeys.caseResponses(item.caseId),
          })
          void client.invalidateQueries({
            queryKey: queryKeys.caseHistory(item.caseId),
          })
          void client.invalidateQueries({ queryKey: ["account", "cases"] })
          void client.invalidateQueries({ queryKey: queryKeys.casesList })
        }
        void client.invalidateQueries({ queryKey: ["account", "applications"] })
        void client.invalidateQueries({ queryKey: ["account", "assignments"] })
        if (item.eventType.startsWith("CHAT_")) void invalidateChatData(client)
        const badgeAwarded = item.eventType === "BADGE_AWARDED"
        if (badgeAwarded)
          void client.invalidateQueries({ queryKey: queryKeys.myBadges })
        const href = inboxItemHref(item)
        const showToast = badgeAwarded ? toast.success : toast
        showToast(item.title, {
          id: item.id,
          description: item.message,
          ...(href
            ? {
                action: {
                  label: badgeAwarded ? "Мои значки" : "Посмотреть",
                  onClick: () => {
                    if (!current()) return
                    if (badgeAwarded) {
                      void client.invalidateQueries({
                        queryKey: queryKeys.myBadges,
                      })
                      navigateToInboxItem(href, router.push)
                    }
                    void inboxApi
                      .read(item.id)
                      .then(() => {
                        if (!current()) return
                        void client.invalidateQueries({
                          queryKey: queryKeys.inbox,
                        })
                        if (!badgeAwarded) router.push(href)
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
  return <MandatoryNotifications />
}
