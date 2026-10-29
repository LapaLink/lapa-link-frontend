"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Ellipsis,
  EllipsisVertical,
  CloudOff,
  Flag,
  Lock,
  ShieldAlert,
  MessageCircle,
  MessageSquareOff,
  Pencil,
  SendHorizontal,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/api"
import {
  useAuth,
  useChatMessages,
  useCloseConversation,
  useConversation,
  useDeleteMessage,
  useEditMessage,
  useHideConversation,
  useReopenConversation,
  useUnhideConversation,
} from "@/hooks"
import { useChatSocket, useTypingUsers } from "@/components/providers"
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CLOSED_CONVERSATION_TTL_DAYS,
  chatErrorMessage,
  conversationDeletionDate,
  isClosedByModerator,
  conversationTargetHref,
  counterpart,
  flattenHistory,
  isConversationOwner,
  isReadBy,
  type ChatFeedMessage,
} from "@/lib/chat"
import { ROUTES } from "@/lib/constants"
import {
  ComplaintDialog,
  ConversationRequestActions,
  EmptyState,
  FormAlert,
  IconCircle,
  Loader,
  LoadingButton,
  RequireAuth,
  SectionCard,
  UserAvatar,
} from "@/components/common"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Textarea,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import type { Conversation } from "@/types"

const timeFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})
const dateFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
/** "Typing" is repeated at most this often while the user keeps typing. */
const TYPING_REPEAT = 3000
/** Without input for this long the user is no longer typing. */
const TYPING_IDLE = 4000

export function Chat({ conversationId }: { conversationId: string }) {
  return (
    <RequireAuth guestMessage="Войдите, чтобы открыть переписку.">
      <ChatContent conversationId={conversationId} />
    </RequireAuth>
  )
}

function ChatContent({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId)
  if (conversation.isPending)
    return (
      <div
        role="status"
        aria-label="Загружаем диалог"
        className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      >
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-[50dvh] w-full rounded-2xl" />
      </div>
    )
  if (conversation.isError) {
    if (
      conversation.error instanceof ApiError &&
      conversation.error.status === 404
    )
      return (
        <EmptyState
          className="mx-auto w-full max-w-md"
          icon={MessageSquareOff}
          titleAs="h1"
          title="Диалог удалён"
          description={`Закрытые диалоги удаляются через ${CLOSED_CONVERSATION_TTL_DAYS} дней. Также возможно, что ссылка устарела или у вас нет доступа к этому диалогу.`}
        >
          <Button asChild variant="outline" className="h-11 sm:h-10">
            <Link href={ROUTES.CHATS}>К списку диалогов</Link>
          </Button>
        </EmptyState>
      )
    return (
      <EmptyState
        className="mx-auto w-full max-w-3xl"
        icon={CloudOff}
        titleAs="h1"
        title="Не получилось загрузить диалог"
      >
        <FormAlert
          message={chatErrorMessage(
            conversation.error,
            "Не удалось загрузить диалог.",
          )}
        />
        <Button
          variant="outline"
          className="h-11 sm:h-10"
          onClick={() => void conversation.refetch()}
        >
          Попробовать ещё раз
        </Button>
      </EmptyState>
    )
  }
  return <ChatView conversation={conversation.data} />
}

/**
 * Tells the other participant that the user is typing: `true` at most every
 * 3 seconds while typing, `false` after 4 seconds without input, on an empty
 * field, on `stop` (sending) and when disabled or unmounted.
 */
function useTypingSignal(conversationId: string, enabled: boolean) {
  const { sendTyping } = useChatSocket()
  const state = useRef<{
    sentAt: number
    idle?: ReturnType<typeof setTimeout>
  }>({ sentAt: 0 })
  const stop = useCallback(() => {
    const current = state.current
    clearTimeout(current.idle)
    current.idle = undefined
    if (current.sentAt) sendTyping(conversationId, false)
    current.sentAt = 0
  }, [conversationId, sendTyping])
  const input = useCallback(
    (value: string) => {
      if (!enabled || !value.trim()) return stop()
      const current = state.current
      const now = Date.now()
      if (
        now - current.sentAt >= TYPING_REPEAT &&
        sendTyping(conversationId, true)
      )
        current.sentAt = now
      clearTimeout(current.idle)
      current.idle = setTimeout(stop, TYPING_IDLE)
    },
    [conversationId, enabled, sendTyping, stop],
  )
  useEffect(() => {
    if (!enabled) stop()
    return stop
  }, [enabled, stop])
  return { input, stop }
}

function ChatView({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth()
  const { status, sendMessage, watch } = useChatSocket()
  const active = conversation.status === "ACTIVE"
  const closed = conversation.status === "CLOSED"
  const history = useChatMessages(conversation.id, active || closed)
  const messages = useMemo(() => flattenHistory(history.data), [history.data])
  const other = counterpart(conversation, user?.id)
  const targetHref = conversationTargetHref(conversation)
  const isOwner = isConversationOwner(conversation, user?.id)
  const typingNames = useTypingUsers(conversation.id).map(
    (id) =>
      conversation.participants.find((participant) => participant.userId === id)
        ?.displayName || "Собеседник",
  )

  useEffect(() => watch(conversation.id), [watch, conversation.id])

  const feed = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  // Distance from the bottom to restore after older messages are prepended.
  const anchor = useRef<number | null>(null)
  const atBottom = useRef(true)
  const [text, setText] = useState("")
  // The message being edited and the unsent text to restore afterwards.
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(
    null,
  )
  const [deleting, setDeleting] = useState<ChatFeedMessage | null>(null)
  const edit = useEditMessage(conversation.id)
  const remove = useDeleteMessage(conversation.id)

  useLayoutEffect(() => {
    const element = feed.current
    if (!element) return
    if (anchor.current !== null) {
      element.scrollTop = element.scrollHeight - anchor.current
      anchor.current = null
    } else if (atBottom.current) element.scrollTop = element.scrollHeight
  }, [messages])

  function loadOlder() {
    const element = feed.current
    if (!element || !history.hasNextPage || history.isFetchingNextPage) return
    anchor.current = element.scrollHeight - element.scrollTop
    void history.fetchNextPage()
  }

  function onScroll() {
    const element = feed.current
    if (!element) return
    atBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 48
    if (element.scrollTop < 80) loadOlder()
  }

  const canWrite = conversation.writable && active && history.isSuccess
  const editTarget =
    editing && canWrite
      ? messages.find(
          (message) =>
            message.id === editing.id && !message.deletedAt && !message.status,
        )
      : undefined
  // The edited message was deleted or the conversation became read-only.
  if (editing && !editTarget) {
    setEditing(null)
    setText(editing.draft)
  }
  const typing = useTypingSignal(conversation.id, canWrite && !editing)

  function startEdit(message: ChatFeedMessage) {
    setEditing({ id: message.id, draft: editing ? editing.draft : text })
    setText(message.text ?? "")
    input.current?.focus()
  }
  function cancelEdit() {
    if (!editing) return
    setEditing(null)
    setText(editing.draft)
  }
  function submit() {
    const value = text.trim()
    if (!value || !canWrite) return
    if (editing) {
      if (!editTarget || edit.isPending) return
      const { draft } = editing
      if (value === editTarget.text) return cancelEdit()
      edit.mutate(
        { messageId: editTarget.id, text: value },
        {
          onSuccess: () => {
            setEditing(null)
            setText(draft)
          },
          onError: (error) =>
            toast.error(
              chatErrorMessage(error, "Не удалось изменить сообщение."),
            ),
        },
      )
      return
    }
    atBottom.current = true
    typing.stop()
    sendMessage(conversation.id, value)
    setText("")
    input.current?.focus()
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && editing) {
      event.preventDefault()
      cancelEdit()
      return
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
      return
    event.preventDefault()
    submit()
  }

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <header className="flex items-center gap-2 rounded-2xl border bg-card p-2 sm:gap-3 sm:p-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-11 rounded-full text-primary sm:size-10"
          aria-label="К списку диалогов"
        >
          <Link href={ROUTES.CHATS}>
            <ArrowLeft />
          </Link>
        </Button>
        {other && (
          <UserAvatar user={{ displayName: other.displayName }} size="lg" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-lg font-bold">
            {other?.displayName || "Собеседник"}
          </h1>
          {targetHref ? (
            <Link
              href={targetHref}
              className="truncate text-sm text-primary hover:underline"
            >
              {conversation.targetTitle}
            </Link>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              {conversation.targetTitle}
            </span>
          )}
        </div>
        <ConversationMenu conversation={conversation} />
      </header>

      {conversation.status === "REQUESTED" && (
        <SectionCard
          icon={MessageCircle}
          title={isOwner ? "Запрос на чат" : "Ожидает ответа автора"}
          description={
            isOwner
              ? `${other?.displayName || "Пользователь"} хочет обсудить с вами помощь.`
              : "Чат откроется, когда автор объявления примет запрос."
          }
        >
          {isOwner && (
            <ConversationRequestActions
              conversationId={conversation.id}
              requesterName={other?.displayName || "Пользователь"}
            />
          )}
        </SectionCard>
      )}
      {conversation.status === "DECLINED" && (
        <FormAlert message="Автор отклонил запрос на чат." />
      )}

      {(active || closed) && (
        <>
          {status !== "connected" && (
            <Loader
              label="Переподключаемся…"
              className="self-start text-muted-foreground"
            />
          )}
          <div
            ref={feed}
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-label="Сообщения"
            tabIndex={0}
            className="flex h-[55dvh] flex-col overflow-y-auto overscroll-contain rounded-2xl border bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
          >
            {history.hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                className="self-center"
                disabled={history.isFetchingNextPage}
                onClick={loadOlder}
              >
                {history.isFetchingNextPage
                  ? "Загружаем…"
                  : "Показать предыдущие сообщения"}
              </Button>
            )}
            {history.isPending ? (
              <Loader label="Загружаем сообщения…" className="m-auto" />
            ) : history.isError ? (
              <FormAlert
                message={chatErrorMessage(
                  history.error,
                  "Не удалось загрузить сообщения.",
                )}
              />
            ) : messages.length ? (
              <ol className="mt-auto flex flex-col gap-3">
                {messages.map((message) => {
                  const mine = message.senderId === user?.id
                  return (
                    <MessageItem
                      key={message.clientMessageId || message.id}
                      message={message}
                      mine={mine}
                      read={mine && isReadBy(message, other)}
                      editing={editing?.id === message.id}
                      canEdit={canWrite}
                      onEdit={() => startEdit(message)}
                      onDelete={() => setDeleting(message)}
                      onRetry={() =>
                        sendMessage(
                          conversation.id,
                          message.text ?? "",
                          message.clientMessageId,
                        )
                      }
                    />
                  )
                })}
              </ol>
            ) : (
              <p className="m-auto text-sm text-muted-foreground">
                {closed
                  ? "Сообщений нет."
                  : "Сообщений пока нет. Напишите первым."}
              </p>
            )}
          </div>

          {active && (
            <p
              aria-live="polite"
              className="-mb-2 min-h-4 text-xs text-muted-foreground"
            >
              {typingNames.length > 0 && `${typingNames.join(", ")} печатает…`}
            </p>
          )}
          {closed ? (
            <ClosedNotice
              conversation={conversation}
              userId={user?.id}
              isOwner={isOwner}
              targetHref={targetHref}
            />
          ) : conversation.writable ? (
            <form
              className="flex flex-col gap-2 rounded-2xl border bg-card p-3"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              {editing && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-1 text-xs text-primary">
                  <span className="flex items-center gap-1.5">
                    <Pencil aria-hidden className="size-3.5" />
                    Редактирование сообщения · Esc — отмена
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Отменить редактирование"
                    onClick={cancelEdit}
                  >
                    <X />
                  </Button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  ref={input}
                  value={text}
                  maxLength={CHAT_MESSAGE_MAX_LENGTH}
                  rows={2}
                  aria-label={editing ? "Изменённое сообщение" : "Сообщение"}
                  aria-describedby="chat-counter"
                  placeholder="Напишите сообщение…"
                  className="max-h-40 min-h-12 resize-none"
                  onChange={(event) => {
                    setText(event.target.value)
                    typing.input(event.target.value)
                  }}
                  onKeyDown={onKeyDown}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-12 rounded-full"
                  aria-label={editing ? "Сохранить" : "Отправить"}
                  disabled={!canWrite || !text.trim() || edit.isPending}
                >
                  {editing ? <Check /> : <SendHorizontal />}
                </Button>
              </div>
              <p
                id="chat-counter"
                className="text-right text-xs text-muted-foreground"
              >
                {text.length}/{CHAT_MESSAGE_MAX_LENGTH}
              </p>
            </form>
          ) : (
            <p className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-sm text-muted-foreground sm:p-4">
              <IconCircle icon={Lock} tone="muted" size="sm" />
              Сейчас в этот диалог нельзя писать. История переписки остаётся
              доступной.
            </p>
          )}
        </>
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сообщение?</AlertDialogTitle>
            <AlertDialogDescription>
              Сообщение будет удалено у вас и у собеседника. Отменить это
              нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                remove.mutate(deleting, {
                  onError: (error) =>
                    toast.error(
                      chatErrorMessage(error, "Не удалось удалить сообщение."),
                    ),
                })
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/**
 * Close (active only), hide/unhide and report actions for the conversation.
 * Reporting works in any status: people often close a chat first.
 */
function ConversationMenu({ conversation }: { conversation: Conversation }) {
  const close = useCloseConversation()
  const hide = useHideConversation()
  const unhide = useUnhideConversation()
  const [confirming, setConfirming] = useState(false)
  const [reporting, setReporting] = useState(false)
  const busy = close.isPending || hide.isPending || unhide.isPending
  const onError = (fallback: string) => (error: unknown) =>
    toast.error(chatErrorMessage(error, fallback))
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Действия с диалогом"
            disabled={busy}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conversation.status === "ACTIVE" && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirming(true)}
            >
              Закрыть диалог
            </DropdownMenuItem>
          )}
          {conversation.hidden ? (
            <DropdownMenuItem
              onSelect={() =>
                unhide.mutate(conversation.id, {
                  onError: onError("Не удалось вернуть диалог в список."),
                })
              }
            >
              Вернуть в список
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                hide.mutate(conversation.id, {
                  onSuccess: () =>
                    toast.success(
                      "Диалог скрыт. Он вернётся в список, когда придёт новое сообщение.",
                    ),
                  onError: onError("Не удалось скрыть диалог."),
                })
              }
            >
              Скрыть чат
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setReporting(true)}>
            <Flag aria-hidden />
            Пожаловаться
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComplaintDialog
        open={reporting}
        onOpenChange={setReporting}
        targetType="CONVERSATION"
        targetId={conversation.id}
        title="Пожаловаться на переписку"
        description="Модератор увидит последние 200 сообщений такими, какие они сейчас. Собеседник не узнает, кто отправил жалобу."
        placeholder="Например: оскорбления в переписке."
        emptyMessage="Опишите, что не так в переписке."
      />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть диалог?</AlertDialogTitle>
            <AlertDialogDescription>
              Собеседник не сможет писать. Через {CLOSED_CONVERSATION_TTL_DAYS}{" "}
              дней диалог будет удалён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                close.mutate(conversation.id, {
                  onError: onError("Не удалось закрыть диалог."),
                })
              }
            >
              Закрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Replaces the input of a closed conversation: who closed it, reopening and the deletion date. */
function ClosedNotice({
  conversation,
  userId,
  isOwner,
  targetHref,
}: {
  conversation: Conversation
  userId: string | undefined
  isOwner: boolean
  targetHref: string | null
}) {
  const reopen = useReopenConversation()
  const deletion = conversationDeletionDate(conversation)
  const automatic = conversation.closedBy === null
  const byModerator = isClosedByModerator(conversation)
  const byMe = !automatic && conversation.closedBy === userId
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-start gap-3">
        <IconCircle
          icon={byModerator ? ShieldAlert : Lock}
          tone={byModerator ? "danger" : "muted"}
          size="sm"
        />
        <div className="flex flex-col gap-1">
          {byModerator && (
            <p className="font-semibold text-foreground">
              Чат закрыт модератором
            </p>
          )}
          <p>
            {byModerator
              ? "Писать сюда больше нельзя, открыть чат снова не получится."
              : automatic
              ? "Диалог закрыт: чат выключен, объявление закрыто или отклик отменён. Он откроется снова, когда условия вернутся."
              : byMe
                ? "Вы закрыли диалог."
                : "Собеседник закрыл диалог."}{" "}
            История переписки остаётся доступной.
          </p>
          {deletion && <p>Будет удалён {dateFormat.format(deletion)}.</p>}
          {automatic && isOwner && targetHref && (
            <Link href={targetHref} className="text-primary hover:underline">
              Настроить чат на странице объявления
            </Link>
          )}
        </div>
      </div>
      {byMe && (
        <LoadingButton
          variant="outline"
          className="h-11 shrink-0 sm:h-10"
          loading={reopen.isPending}
          loadingText="Открываем…"
          onClick={() =>
            reopen.mutate(conversation.id, {
              onError: (error) =>
                toast.error(
                  chatErrorMessage(error, "Не удалось открыть диалог."),
                ),
            })
          }
        >
          Открыть снова
        </LoadingButton>
      )}
    </div>
  )
}

function MessageItem({
  message,
  mine,
  read,
  editing,
  canEdit,
  onEdit,
  onDelete,
  onRetry,
}: {
  message: ChatFeedMessage
  mine: boolean
  /** Own delivered message the other participant has read. */
  read: boolean
  editing: boolean
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onRetry: () => void
}) {
  const deleted = !!message.deletedAt
  const actions = mine && !deleted && !message.status
  return (
    <li
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        mine ? "items-end self-end" : "items-start self-start",
      )}
    >
      <div className={cn("flex items-center gap-1", mine && "flex-row-reverse")}>
        {deleted ? (
          <p className="rounded-2xl border border-dashed px-3 py-2 text-sm italic text-muted-foreground">
            Сообщение удалено
          </p>
        ) : (
          <p
            className={cn(
              "rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
              mine
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md bg-muted",
              message.status && "opacity-70",
              editing && "ring-2 ring-ring ring-offset-2",
            )}
          >
            {message.text}
          </p>
        )}
        {actions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                aria-label="Действия с сообщением"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              {canEdit && (
                <DropdownMenuItem onSelect={onEdit}>Изменить</DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {message.status === "sending" ? (
        <span className="text-xs text-muted-foreground">Отправляется…</span>
      ) : message.status === "failed" ? (
        <button
          type="button"
          className="text-xs font-medium text-destructive hover:underline"
          onClick={onRetry}
        >
          Не отправлено — повторить
        </button>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <time dateTime={message.createdAt}>
            {timeFormat.format(new Date(message.createdAt))}
          </time>
          {message.editedAt && !deleted && <span>· изменено</span>}
          {mine && !deleted && (
            <>
              {read ? (
                <CheckCheck aria-hidden className="size-3.5 text-primary" />
              ) : (
                <Check aria-hidden className="size-3.5" />
              )}
              <span className="sr-only">
                {read ? "Прочитано" : "Доставлено"}
              </span>
            </>
          )}
        </span>
      )}
    </li>
  )
}
