"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, CloudOff, LifeBuoy, MessageCircle } from "lucide-react"
import { ApiError, chatApi, getErrorMessage, supportApi } from "@/api"
import { ROUTES } from "@/lib/constants"
import type { SupportQuestion, SupportQuestionStatus } from "@/types"
import {
  EmptyState,
  FormAlert,
  ListPagination,
  LoadingButton,
  PageHeader,
  RequireAuth,
  SectionCard,
  StatusBadge,
} from "@/components/common"
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Skeleton,
  Textarea,
} from "@/components/ui"

const QUESTION_MAX = 2000
const PAGE_SIZE = 20
const LATEST_HASH = "#latest"

const statuses: Record<
  SupportQuestionStatus,
  { label: string; tone: "primary" | "success" | "muted" }
> = {
  NEW: { label: "Ожидает администратора", tone: "primary" },
  IN_PROGRESS: { label: "В работе", tone: "success" },
  CLOSED: { label: "Закрыт", tone: "muted" },
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * "Связаться с администратором": a new question opens its support chat at
 * once; the list shows own questions with status and unread messages.
 * `#latest` (from an "answered" notification) opens the latest open question.
 */
export function Support() {
  return (
    <RequireAuth guestMessage="Войдите, чтобы задать вопрос администратору.">
      <SupportContent />
    </RequireAuth>
  )
}

function SupportContent() {
  const router = useRouter()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [message, setMessage] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // State lags behind a fast double click, so guard synchronously.
  const sending = useRef(false)

  const questions = useQuery({
    queryKey: ["support", "questions", page],
    queryFn: ({ signal }) => supportApi.my(page, PAGE_SIZE, signal),
  })
  // Unread counts live on the support chats.
  const chats = useQuery({
    queryKey: ["chat", "conversations", { targetType: "SUPPORT", size: 100 }],
    queryFn: ({ signal }) =>
      chatApi.list({ targetType: "SUPPORT", size: 100 }, signal),
  })
  const unreadOf = (conversationId: string | null) =>
    chats.data?.content.find((chat) => chat.id === conversationId)
      ?.unreadCount ?? 0

  useEffect(() => {
    if (window.location.hash !== LATEST_HASH || !questions.data) return
    const latest = questions.data.content.find(
      (question) => question.conversationId && question.status !== "CLOSED",
    )
    if (latest?.conversationId)
      router.replace(ROUTES.CHAT(latest.conversationId))
  }, [questions.data, router])

  async function ask() {
    if (sending.current) return
    const text = message.trim()
    setError("")
    if (!text) return setFieldError("Опишите, с чем нужна помощь.")
    setFieldError("")
    sending.current = true
    setBusy(true)
    try {
      const question = await supportApi.ask(text)
      setMessage("")
      void client.invalidateQueries({ queryKey: ["support", "questions"] })
      if (question.conversationId)
        router.push(ROUTES.CHAT(question.conversationId))
    } catch (cause) {
      const text = getErrorMessage(cause, "Не удалось отправить вопрос.")
      if (cause instanceof ApiError && cause.code === "VALIDATION_FAILED")
        setFieldError(cause.fields.message || text)
      // A parallel send of the same question is already on its way.
      else if (!(
        cause instanceof ApiError && cause.code === "OPERATION_IN_PROGRESS"
      ))
        setError(text)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Помощь"
        title="Связаться с администратором"
        description={
          <>
            Задайте вопрос — ответ придёт в чат и уведомлением. Возможно, ответ
            уже есть в{" "}
            <Link href={ROUTES.FAQ} className="text-primary hover:underline">
              частых вопросах
            </Link>
            .
          </>
        }
      />
      <SectionCard icon={LifeBuoy} title="Новый вопрос" fullWidthBody>
        <FormAlert message={error} />
        <Field data-invalid={!!fieldError}>
          <FieldLabel htmlFor="support-question">Ваш вопрос</FieldLabel>
          <Textarea
            id="support-question"
            className="min-h-32"
            maxLength={QUESTION_MAX}
            value={message}
            placeholder="Например: не приходит письмо с подтверждением почты"
            aria-invalid={!!fieldError}
            aria-describedby="support-question-error support-question-count"
            onChange={(event) => setMessage(event.target.value)}
          />
          <FieldDescription id="support-question-count" className="text-right">
            {message.length} / {QUESTION_MAX}
          </FieldDescription>
          <FieldError id="support-question-error">{fieldError}</FieldError>
        </Field>
        <LoadingButton
          className="h-11 self-start px-6 sm:h-10"
          loading={busy}
          loadingText="Отправляем…"
          onClick={() => void ask()}
        >
          Отправить
        </LoadingButton>
      </SectionCard>

      <h2 className="text-xl font-bold">Мои вопросы</h2>
      {questions.isPending ? (
        <div
          role="status"
          aria-label="Загружаем вопросы"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : questions.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить вопросы">
          <FormAlert
            message={getErrorMessage(
              questions.error,
              "Не удалось загрузить вопросы.",
            )}
          />
          <Button variant="outline" onClick={() => void questions.refetch()}>
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !questions.data.content.length ? (
        <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
          Вы ещё не задавали вопросов.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {questions.data.content.map((question) => (
              <QuestionItem
                key={question.id}
                question={question}
                unread={unreadOf(question.conversationId)}
              />
            ))}
          </ul>
          <ListPagination
            label="Страницы вопросов"
            page={page}
            totalPages={questions.data.totalPages}
            busy={questions.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}

function QuestionItem({
  question,
  unread,
}: {
  question: SupportQuestion
  unread: number
}) {
  const status = statuses[question.status] ?? {
    label: question.status,
    tone: "muted" as const,
  }
  const body = (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <time
          dateTime={question.createdAt}
          className="text-xs text-foreground/60"
        >
          {dateFormat.format(new Date(question.createdAt))}
        </time>
        {!question.conversationId && (
          <span className="text-xs text-foreground/60">Переписка удалена</span>
        )}
      </span>
      <span className="line-clamp-2 text-sm whitespace-pre-line [overflow-wrap:anywhere]">
        {question.message}
      </span>
    </span>
  )
  const className =
    "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card"
  return (
    <li>
      {question.conversationId ? (
        <Link
          href={ROUTES.CHAT(question.conversationId)}
          className={`${className} group outline-none transition-colors hover:border-primary/25 focus-visible:ring-3 focus-visible:ring-ring/40`}
        >
          <MessageCircle aria-hidden className="size-5 shrink-0 text-primary" />
          {body}
          {unread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              <span className="sr-only">Непрочитанных: </span>
              {unread}
            </span>
          )}
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-foreground/40 group-hover:text-primary"
          />
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}
