"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlarmClock,
  Bell,
  CheckCheck,
  ChevronRight,
  TimerOff,
  type LucideIcon,
} from "lucide-react"
import { useInbox, useReadNotifications, useUnreadCount } from "@/hooks"
import { getErrorMessage } from "@/api"
import { inboxItemHref } from "@/lib/inbox"
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Skeleton,
} from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"
import { ListPagination } from "../ListPagination/ListPagination"

// Need deadline events get an icon next to the title.
const eventIcons: Record<string, LucideIcon> = {
  NEED_DEADLINE_APPROACHING: AlarmClock,
  NEED_EXPIRED: TimerOff,
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const router = useRouter()
  const count = useUnreadCount()
  const inbox = useInbox(page, open)
  const read = useReadNotifications()
  const unread = count.data?.count ?? 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11 rounded-full"
          aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 min-w-5 rounded-full bg-primary px-1 text-[10px] font-bold leading-5 text-primary-foreground"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Уведомления</DialogTitle>
          <DialogDescription>
            Ответы и новости о вашей помощи животным.
          </DialogDescription>
        </DialogHeader>
        {unread > 0 && (
          <Button
            variant="outline"
            disabled={read.isPending}
            onClick={() => read.mutate(null)}
          >
            <CheckCheck className="size-4" />
            Прочитать все
          </Button>
        )}
        <FormAlert
          message={
            read.isError
              ? getErrorMessage(
                  read.error,
                  "Не удалось отметить уведомление прочитанным.",
                )
              : ""
          }
        />
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {inbox.isPending ? (
            <div
              role="status"
              aria-label="Загружаем уведомления"
              className="space-y-3"
            >
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : inbox.isError ? (
            <div className="space-y-3">
              <FormAlert
                message={getErrorMessage(
                  inbox.error,
                  "Не удалось загрузить уведомления.",
                )}
              />
              <Button variant="outline" onClick={() => void inbox.refetch()}>
                Попробовать ещё раз
              </Button>
            </div>
          ) : inbox.data.content.length ? (
            <ul className="space-y-2">
              {inbox.data.content.map((item) => {
                const href = inboxItemHref(item)
                const EventIcon = eventIcons[item.eventType]
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={read.isPending}
                      className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${item.read ? "border-border bg-card" : "border-primary/20 bg-primary-soft/60"}`}
                      onClick={() => {
                        const navigate = () => {
                          if (href) {
                            setOpen(false)
                            router.push(href)
                          }
                        }
                        if (item.read) navigate()
                        else read.mutate(item.id, { onSuccess: navigate })
                      }}
                    >
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
                      />
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        <span className="flex items-start gap-1.5 text-sm font-bold">
                          {EventIcon && (
                            <EventIcon
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0 text-primary"
                            />
                          )}
                          {item.title}
                        </span>
                        <span className="mt-1 block whitespace-pre-wrap text-sm text-muted-foreground">
                          {item.message}
                        </span>
                        <time
                          dateTime={item.createdAt}
                          className="mt-2 block text-xs text-muted-foreground"
                        >
                          {new Intl.DateTimeFormat("ru", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(item.createdAt))}
                        </time>
                        {!item.read && (
                          <span className="sr-only">Не прочитано</span>
                        )}
                      </span>
                      {href && (
                        <ChevronRight className="mt-1 size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Bell className="size-10 text-primary/50" />
              <p className="font-semibold">Пока тихо</p>
              <p className="text-sm text-muted-foreground">
                Здесь появятся новые отклики и новости по объявлениям.
              </p>
            </div>
          )}
        </div>
        <ListPagination
          label="Страницы уведомлений"
          page={page}
          totalPages={inbox.data?.totalPages ?? 0}
          busy={inbox.isFetching || read.isPending}
          onPageChange={setPage}
        />
      </DialogContent>
    </Dialog>
  )
}
