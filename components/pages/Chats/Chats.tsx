"use client"

import Link from "next/link"
import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { useAuth, useConversations } from "@/hooks"
import {
  chatErrorMessage,
  conversationStatusLabels,
  counterpart,
} from "@/lib/chat"
import { ROUTES } from "@/lib/constants"
import {
  FormAlert,
  ListPagination,
  RequireAuth,
  UserAvatar,
} from "@/components/common"
import { Button, Skeleton } from "@/components/ui"
import type { Conversation } from "@/types"

const PAGE_SIZE = 20
const timeFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function Chats() {
  return (
    <RequireAuth guestMessage="Войдите, чтобы увидеть свои диалоги.">
      <ChatsContent />
    </RequireAuth>
  )
}

function ChatsContent() {
  const [page, setPage] = useState(0)
  const conversations = useConversations({ page, size: PAGE_SIZE })
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Сообщения
        </h1>
        <p className="text-muted-foreground">
          Переписка с авторами объявлений и с теми, кто предложил помощь.
        </p>
      </div>
      {conversations.isPending ? (
        <div role="status" aria-label="Загружаем диалоги" className="flex flex-col gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : conversations.isError ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert
            message={chatErrorMessage(
              conversations.error,
              "Не удалось загрузить диалоги.",
            )}
          />
          <Button
            variant="outline"
            onClick={() => void conversations.refetch()}
          >
            Попробовать ещё раз
          </Button>
        </div>
      ) : conversations.data.content.length ? (
        <ul className="flex flex-col gap-2">
          {conversations.data.content.map((conversation) => (
            <ConversationItem key={conversation.id} conversation={conversation} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border py-10 text-center">
          <MessageCircle className="size-10 text-primary/50" aria-hidden />
          <p className="font-semibold">Диалогов пока нет</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Предложите помощь в объявлении и напишите автору, когда он включит
            чат.
          </p>
        </div>
      )}
      {conversations.data && (
        <ListPagination
          label="Страницы диалогов"
          page={page}
          totalPages={conversations.data.totalPages}
          busy={conversations.isFetching}
          onPageChange={setPage}
        />
      )}
    </section>
  )
}

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth()
  const other = counterpart(conversation, user?.id)
  const unread = conversation.unreadCount
  const time = conversation.lastMessageAt ?? conversation.createdAt
  return (
    <li>
      <Link
        href={ROUTES.CHAT(conversation.id)}
        className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar user={{ displayName: other?.displayName || "?" }} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold">
            {other?.displayName || "Собеседник"}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {conversation.targetTitle}
          </span>
          <span className="text-xs text-muted-foreground">
            {conversation.status === "ACTIVE" && !conversation.writable
              ? "Только чтение"
              : conversationStatusLabels[conversation.status]}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <time dateTime={time} className="text-xs text-muted-foreground">
            {timeFormat.format(new Date(time))}
          </time>
          {unread > 0 && (
            <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-5 text-primary-foreground">
              <span className="sr-only">Непрочитанных: </span>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
