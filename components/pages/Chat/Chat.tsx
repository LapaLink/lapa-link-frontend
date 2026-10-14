"use client"

import Link from "next/link"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { ArrowLeft, SendHorizontal } from "lucide-react"
import { ApiError } from "@/api"
import { useAuth, useChatMessages, useConversation } from "@/hooks"
import { useChatSocket } from "@/components/providers"
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatErrorMessage,
  conversationTargetHref,
  counterpart,
  flattenHistory,
  isConversationOwner,
  type ChatFeedMessage,
} from "@/lib/chat"
import { ROUTES } from "@/lib/constants"
import {
  ConversationRequestActions,
  FormAlert,
  Loader,
  RequireAuth,
  UserAvatar,
} from "@/components/common"
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[50dvh] w-full" />
      </div>
    )
  if (conversation.isError) {
    if (
      conversation.error instanceof ApiError &&
      conversation.error.status === 404
    )
      return (
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle>Диалог не найден</CardTitle>
            <CardDescription>
              Возможно, ссылка устарела или у вас нет доступа к этому диалогу.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href={ROUTES.CHATS}>К списку диалогов</Link>
            </Button>
          </CardFooter>
        </Card>
      )
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3">
        <FormAlert
          message={chatErrorMessage(
            conversation.error,
            "Не удалось загрузить диалог.",
          )}
        />
        <Button variant="outline" onClick={() => void conversation.refetch()}>
          Попробовать ещё раз
        </Button>
      </div>
    )
  }
  return <ChatView conversation={conversation.data} />
}

function ChatView({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth()
  const { status, sendMessage, watch } = useChatSocket()
  const active = conversation.status === "ACTIVE"
  const history = useChatMessages(conversation.id, active)
  const messages = useMemo(() => flattenHistory(history.data), [history.data])
  const other = counterpart(conversation, user?.id)
  const targetHref = conversationTargetHref(conversation)
  const isOwner = isConversationOwner(conversation, user?.id)

  useEffect(() => watch(conversation.id), [watch, conversation.id])

  const feed = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  // Distance from the bottom to restore after older messages are prepended.
  const anchor = useRef<number | null>(null)
  const atBottom = useRef(true)
  const [text, setText] = useState("")

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
  function submit() {
    const value = text.trim()
    if (!value || !canWrite) return
    atBottom.current = true
    sendMessage(conversation.id, value)
    setText("")
    input.current?.focus()
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
      return
    event.preventDefault()
    submit()
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="К списку диалогов">
          <Link href={ROUTES.CHATS}>
            <ArrowLeft />
          </Link>
        </Button>
        {other && <UserAvatar user={{ displayName: other.displayName }} />}
        <div className="flex min-w-0 flex-col">
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
      </header>

      {conversation.status === "REQUESTED" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isOwner ? "Запрос на чат" : "Ожидает ответа автора"}
            </CardTitle>
            <CardDescription>
              {isOwner
                ? `${other?.displayName || "Пользователь"} хочет обсудить с вами помощь.`
                : "Чат откроется, когда автор объявления примет запрос."}
            </CardDescription>
          </CardHeader>
          {isOwner && (
            <CardFooter>
              <ConversationRequestActions
                conversationId={conversation.id}
                requesterName={other?.displayName || "Пользователь"}
              />
            </CardFooter>
          )}
        </Card>
      )}
      {conversation.status === "DECLINED" && (
        <FormAlert message="Автор отклонил запрос на чат." />
      )}

      {active && (
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
            className="flex h-[55dvh] flex-col overflow-y-auto overscroll-contain rounded-xl border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
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
                {messages.map((message) => (
                  <MessageItem
                    key={message.clientMessageId || message.id}
                    message={message}
                    mine={message.senderId === user?.id}
                    onRetry={() =>
                      sendMessage(
                        conversation.id,
                        message.text,
                        message.clientMessageId,
                      )
                    }
                  />
                ))}
              </ol>
            ) : (
              <p className="m-auto text-sm text-muted-foreground">
                Сообщений пока нет. Напишите первым.
              </p>
            )}
          </div>

          {conversation.writable ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <div className="flex items-end gap-2">
                <Textarea
                  ref={input}
                  value={text}
                  maxLength={CHAT_MESSAGE_MAX_LENGTH}
                  rows={2}
                  aria-label="Сообщение"
                  aria-describedby="chat-counter"
                  placeholder="Напишите сообщение…"
                  className="max-h-40 min-h-11 resize-none"
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  aria-label="Отправить"
                  disabled={!canWrite || !text.trim()}
                >
                  <SendHorizontal />
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
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Чат закрыт: автор выключил чат, отклик отменён или объявление
              закрыто. История переписки остаётся доступной.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function MessageItem({
  message,
  mine,
  onRetry,
}: {
  message: ChatFeedMessage
  mine: boolean
  onRetry: () => void
}) {
  return (
    <li
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        mine ? "items-end self-end" : "items-start self-start",
      )}
    >
      <p
        className={cn(
          "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
          mine ? "bg-primary text-primary-foreground" : "bg-muted",
          message.status && "opacity-70",
        )}
      >
        {message.text}
      </p>
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
        <time
          dateTime={message.createdAt}
          className="text-xs text-muted-foreground"
        >
          {timeFormat.format(new Date(message.createdAt))}
        </time>
      )}
    </li>
  )
}
