"use client"

import Link from "next/link"
import { useState } from "react"
import { MessageCircle } from "lucide-react"
import {
  useChatPermission,
  useParticipantConversations,
  useRequestChat,
  useSetChatPermission,
} from "@/hooks"
import {
  caseChatAction,
  chatErrorMessage,
  initiator,
  type CaseChatAction,
} from "@/lib/chat"
import { ROUTES } from "@/lib/constants"
import {
  ConversationRequestActions,
  FormAlert,
  LoadingButton,
} from "@/components/common"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldLabel,
  Skeleton,
  Switch,
} from "@/components/ui"
import type { Conversation } from "@/types"

export type CaseConversations = ReturnType<typeof useCaseConversations>

/** The author's conversations with the given helpers, plus a lookup by the helper's user id. */
export function useCaseConversations(
  caseId: string,
  helperIds: string[],
  enabled: boolean,
) {
  const result = useParticipantConversations("CASE", caseId, helperIds, enabled)
  const byUser = new Map<string, Conversation>()
  for (const conversation of result.conversations) {
    const userId = initiator(conversation)?.userId
    if (userId) byUser.set(userId, conversation)
  }
  return { ...result, byUser }
}

export function CaseChat({
  caseId,
  caseOpen,
  isAuthor,
  hasActiveResponse,
  chats,
}: {
  caseId: string
  caseOpen: boolean
  isAuthor: boolean
  hasActiveResponse: boolean
  /** Author's conversations with the helpers on the responses page. */
  chats: CaseConversations
}) {
  if (isAuthor)
    return <AuthorCaseChat caseId={caseId} caseOpen={caseOpen} chats={chats} />
  return <HelperCaseChat caseId={caseId} hasActiveResponse={hasActiveResponse} />
}

function AuthorCaseChat({
  caseId,
  caseOpen,
  chats,
}: {
  caseId: string
  caseOpen: boolean
  chats: CaseConversations
}) {
  const permission = useChatPermission("CASE", caseId, true)
  const toggle = useSetChatPermission("CASE", caseId)
  const requestList = chats.conversations.filter(
    (conversation) => conversation.status === "REQUESTED",
  )
  const activeList = chats.conversations.filter(
    (conversation) => conversation.status === "ACTIVE",
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Чат с откликнувшимися</CardTitle>
        <CardDescription>
          Те, кто предложил помощь, смогут попросить чат с вами. Вы решаете,
          кому ответить.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {caseOpen && (
          <div className="flex items-start justify-between gap-4">
            <FieldLabel htmlFor="case-chat" className="font-semibold">
              Разрешить чат с откликнувшимися
            </FieldLabel>
            {permission.isPending ? (
              <Skeleton className="h-5 w-9 rounded-full" />
            ) : (
              <Switch
                id="case-chat"
                checked={!!permission.data?.enabled}
                disabled={toggle.isPending || permission.isError}
                onCheckedChange={(next) => toggle.mutate(next)}
              />
            )}
          </div>
        )}
        <FormAlert
          message={
            permission.isError
              ? chatErrorMessage(
                  permission.error,
                  "Не удалось загрузить настройку чата.",
                )
              : toggle.isError
                ? chatErrorMessage(
                    toggle.error,
                    "Не удалось сохранить настройку чата.",
                  )
                : ""
          }
        />
        {requestList.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="chat-requests">
            <h3 id="chat-requests" className="font-semibold">
              Запросы на чат
            </h3>
            <ul className="flex flex-col gap-2">
              {requestList.map((conversation) => {
                const name =
                  initiator(conversation)?.displayName || "Пользователь"
                return (
                  <li
                    key={conversation.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium [overflow-wrap:anywhere]">
                      {name}
                    </span>
                    <ConversationRequestActions
                      conversationId={conversation.id}
                      requesterName={name}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {activeList.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="chat-active">
            <h3 id="chat-active" className="font-semibold">
              Открытые чаты
            </h3>
            <ul className="flex flex-col gap-2">
              {activeList.map((conversation) => (
                <li
                  key={conversation.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="font-medium [overflow-wrap:anywhere]">
                    {initiator(conversation)?.displayName || "Пользователь"}
                  </span>
                  <OpenChatLink
                    conversationId={conversation.id}
                    unread={conversation.unreadCount}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <FormAlert
          message={
            chats.error
              ? chatErrorMessage(chats.error, "Не удалось загрузить чаты.")
              : ""
          }
        />
      </CardContent>
    </Card>
  )
}

function HelperCaseChat({
  caseId,
  hasActiveResponse,
}: {
  caseId: string
  hasActiveResponse: boolean
}) {
  const permission = useChatPermission("CASE", caseId, true)
  const request = useRequestChat("CASE")
  const [error, setError] = useState("")
  const action: CaseChatAction = caseChatAction({
    isAuthor: false,
    hasActiveResponse,
    permission: permission.data,
  })
  const conversationId = permission.data?.conversationId
  // Visitors who did not offer help see nothing, including load states.
  const loadError = hasActiveResponse ? permission.error : null
  if (action === "hidden" || (action === "loading" && !hasActiveResponse))
    return null
  const texts: Partial<Record<CaseChatAction, string>> = {
    disabled: "Автор пока не включил чат.",
    request: "Можно написать автору: он увидит запрос и решит, открыть ли чат.",
    requested: "Запрос отправлен, ждём ответа автора.",
    declined: "Автор отклонил запрос.",
    open: "Автор открыл чат — можно договориться о деталях.",
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          {action === "loading" && !loadError ? (
            <Skeleton className="h-5 w-56" />
          ) : (
            <p className="text-sm">{texts[action]}</p>
          )}
        </div>
        {action === "request" && (
          <LoadingButton
            className="shrink-0"
            loading={request.isPending}
            loadingText="Отправляем…"
            onClick={() => {
              setError("")
              request.mutate(caseId, {
                onError: (requestError) =>
                  setError(
                    chatErrorMessage(requestError, "Не удалось запросить чат."),
                  ),
              })
            }}
          >
            Написать автору
          </LoadingButton>
        )}
        {action === "open" && conversationId && (
          <OpenChatLink conversationId={conversationId} />
        )}
      </CardContent>
      {(error || loadError) && (
        <CardContent>
          <FormAlert
            message={
              error || chatErrorMessage(loadError, "Не удалось загрузить чат.")
            }
          />
        </CardContent>
      )}
    </Card>
  )
}

function OpenChatLink({
  conversationId,
  unread = 0,
}: {
  conversationId: string
  unread?: number
}) {
  return (
    <Button asChild size="sm" variant="outline" className="shrink-0">
      <Link href={ROUTES.CHAT(conversationId)}>
        Открыть чат
        {unread > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">
            <span className="sr-only">, непрочитанных: </span>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  )
}
