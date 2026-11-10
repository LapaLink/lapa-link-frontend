"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlarmClock,
  Bell,
  Check,
  CheckCheck,
  Ellipsis,
  House,
  HousePlus,
  LifeBuoy,
  Eye,
  EyeOff,
  ChevronRight,
  TimerOff,
  TriangleAlert,
  UserMinus,
  UserX,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import {
  useInbox,
  useReadNotifications,
  useUnreadCount,
  useDeleteNotifications,
} from "@/hooks"
import { getErrorMessage } from "@/api"
import {
  enqueueMandatory,
  inboxItemHref,
  navigateToInboxItem,
} from "@/lib/inbox"
import { queryKeys } from "@/lib/queryKeys"
import type { InboxNotification } from "@/types"
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Skeleton,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { BadgeArtwork } from "../BadgeArtwork/BadgeArtwork"
import { FormAlert } from "../FormAlert/FormAlert"
import { StatusBadge } from "../StatusBadge/StatusBadge"
import { ListPagination } from "../ListPagination/ListPagination"

// Events that get an icon next to the title.
const eventIcons: Record<string, LucideIcon> = {
  NEED_DEADLINE_APPROACHING: AlarmClock,
  NEED_EXPIRED: TimerOff,
  MODERATION_WARNING: TriangleAlert,
  // The helper dropped the need / the author took it back.
  CASE_ASSIGNMENT_DECLINED: UserX,
  CASE_ASSIGNMENT_CANCELLED: UserMinus,
  CASE_HIDDEN: EyeOff,
  CASE_RESTORED: Eye,
  SUPPORT_QUESTION_ANSWERED: LifeBuoy,
  CASE_ADOPTION_REQUEST_CREATED: HousePlus,
  CASE_ADOPTION_REQUEST_CANCELLED: House,
  ADOPTION_REQUEST_STATUS_CHANGED: House,
}

/** An unread mandatory notification: not selectable, opens the modal. */
const isLocked = (item: InboxNotification) => !!item.mandatory && !item.read

const notificationDate = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function NotificationCenter() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const router = useRouter()
  const count = useUnreadCount()
  const inbox = useInbox(page, open)
  const read = useReadNotifications()
  const remove = useDeleteNotifications()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [removing, setRemoving] = useState<string[]>([])
  const unread = count.data?.count ?? 0
  const selectable = inbox.data?.content.filter((item) => !isLocked(item)) ?? []
  const selectedOnPage = selectable
    .filter((item) => selected.includes(item.id))
    .map((item) => item.id)

  function closeSelection() {
    setSelecting(false)
    setSelected([])
  }

  function confirmRemoval(ids: string[]) {
    remove.reset()
    setRemoving(ids)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) closeSelection()
      }}
    >
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
      <DialogContent
        ref={contentRef}
        className="flex max-h-[85dvh] flex-col gap-3 overflow-hidden sm:max-w-lg sm:p-5"
      >
        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="text-lg font-bold">Уведомления</DialogTitle>
          <DialogDescription>
            {unread > 0
              ? `Непрочитанных: ${unread}`
              : "Ответы и новости о вашей помощи животным."}
          </DialogDescription>
        </DialogHeader>
        {selecting ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2">
            {selectable.length > 0 && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={
                    selectedOnPage.length === selectable.length
                      ? true
                      : selectedOnPage.length > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked ? selectable.map((item) => item.id) : [],
                    )
                  }
                />
                Выбрать все
              </label>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={closeSelection}
              >
                Готово
              </Button>
              {selectedOnPage.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-11"
                  disabled={remove.isPending}
                  onClick={() => confirmRemoval(selectedOnPage)}
                >
                  <Trash2 data-icon="inline-start" />
                  Удалить ({selectedOnPage.length})
                </Button>
              )}
            </div>
          </div>
        ) : (
          (unread > 0 || selectable.length > 1) && (
            <div className="flex flex-wrap items-center justify-end gap-1 border-t pt-2">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={read.isPending}
                  onClick={() => read.mutate(null)}
                >
                  <CheckCheck data-icon="inline-start" />
                  Прочитать все
                </Button>
              )}
              {selectable.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setSelecting(true)}
                >
                  Выбрать
                </Button>
              )}
            </div>
          )
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
              className="flex flex-col gap-3"
            >
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : inbox.isError ? (
            <div className="flex flex-col items-start gap-3">
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
            <ul className="divide-y overflow-hidden rounded-2xl border">
              {inbox.data.content.map((item) => {
                const href = inboxItemHref(item)
                const locked = isLocked(item)
                const EventIcon = eventIcons[item.eventType] ?? Bell
                const checkboxId = `inbox-select-${item.id}`
                const selectedItem = selectedOnPage.includes(item.id)
                const bodyClass =
                  "flex min-w-0 flex-1 items-start gap-3 px-3 py-3.5 text-left"
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative flex size-9 shrink-0 items-center justify-center rounded-full",
                        item.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary-soft text-primary",
                      )}
                    >
                      {item.eventType === "BADGE_AWARDED" ? (
                        <BadgeArtwork size={30} />
                      ) : (
                        <EventIcon className="size-4" />
                      )}
                      {!item.read && (
                        <span className="absolute top-0 right-0 size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span
                        className={cn(
                          "block text-sm",
                          item.read ? "font-semibold" : "font-bold",
                        )}
                      >
                        {item.title}
                        {locked && (
                          <StatusBadge
                            tone="primary"
                            className="ml-2 align-middle"
                          >
                            Обязательное
                          </StatusBadge>
                        )}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.message}
                      </span>
                      <time
                        dateTime={item.createdAt}
                        className="mt-1.5 block text-xs text-muted-foreground"
                      >
                        {notificationDate.format(new Date(item.createdAt))}
                      </time>
                      {!item.read && (
                        <span className="sr-only">Не прочитано</span>
                      )}
                    </span>
                  </>
                )
                function openNotification() {
                  if (locked) {
                    client.setQueryData<InboxNotification[]>(
                      queryKeys.inboxMandatory,
                      (queue) => enqueueMandatory(queue, item, true),
                    )
                    return
                  }
                  if (!href) return
                  const navigate = () => {
                    setOpen(false)
                    if (item.eventType === "BADGE_AWARDED")
                      void client.invalidateQueries({
                        queryKey: queryKeys.myBadges,
                      })
                    navigateToInboxItem(href, router.push)
                  }
                  if (item.read) navigate()
                  else if (item.eventType === "BADGE_AWARDED") {
                    read.mutate(item.id)
                    navigate()
                  } else read.mutate(item.id, { onSuccess: navigate })
                }

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start",
                      selectedItem
                        ? "bg-primary-soft"
                        : !item.read && "bg-primary-soft/40",
                    )}
                  >
                    {selecting && !locked ? (
                      <div className="flex min-w-0 flex-1 items-start pl-3">
                        <Checkbox
                          id={checkboxId}
                          aria-label={`Выбрать: ${item.title}`}
                          checked={selectedItem}
                          className="mt-5"
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked === true
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                        <label
                          htmlFor={checkboxId}
                          className={cn(bodyClass, "cursor-pointer")}
                        >
                          {content}
                        </label>
                      </div>
                    ) : !selecting && (locked || href) ? (
                      <button
                        type="button"
                        disabled={!locked && read.isPending}
                        className={cn(
                          bodyClass,
                          "self-stretch transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60",
                        )}
                        onClick={openNotification}
                      >
                        {content}
                        <ChevronRight
                          aria-hidden
                          className="mt-1 size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    ) : (
                      <div className={bodyClass}>{content}</div>
                    )}
                    {!selecting && !locked && (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mt-2 mr-1 size-11"
                            aria-label={`Действия: ${item.title}`}
                          >
                            <Ellipsis aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-max max-w-[calc(100vw-2rem)]"
                        >
                          <DropdownMenuGroup>
                            {!item.read && (
                              <DropdownMenuItem
                                disabled={read.isPending}
                                className="min-h-11"
                                onSelect={() => read.mutate(item.id)}
                              >
                                <Check />
                                Отметить прочитанным
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={remove.isPending}
                              className="min-h-11"
                              onSelect={() => confirmRemoval([item.id])}
                            >
                              <Trash2 />
                              Удалить уведомление
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
          onPageChange={(next) => {
            setSelected([])
            setPage(next)
          }}
        />
      </DialogContent>
      <AlertDialog
        open={removing.length > 0}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) setRemoving([])
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing.length === 1
                ? "Удалить уведомление?"
                : "Удалить уведомления?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing.length === 1
                ? "Уведомление исчезнет из истории."
                : `Выбранные уведомления (${removing.length}) исчезнут из истории.`}{" "}
              Удаление нельзя отменить.
            </AlertDialogDescription>
            <FormAlert
              message={
                remove.isError
                  ? getErrorMessage(
                      remove.error,
                      "Не удалось удалить уведомления. Попробуйте ещё раз.",
                    )
                  : ""
              }
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                remove.mutate(removing, {
                  onSuccess: () => {
                    if (
                      page > 0 &&
                      inbox.data?.content.every((item) =>
                        removing.includes(item.id),
                      )
                    )
                      setPage(page - 1)
                    closeSelection()
                    setRemoving([])
                  },
                })
              }}
            >
              {remove.isPending ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
