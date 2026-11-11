"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { House, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { ApiError, adoptionApi, getErrorMessage } from "@/api"
import { AdoptionFormDialog } from "./AdoptionFormDialog"
import {
  CURATOR_ANSWER_MAX,
  CURATOR_QUESTION_MAX,
  adoptionStatusLabel,
  canAskCuratorQuestion,
  curatorAnswers,
  questionnaireRows,
  isActiveAdoption,
  nextAdoptionStatuses,
} from "@/lib/adoption"
import { ROUTES } from "@/lib/constants"
import type {
  AdoptionRequest,
  AdoptionRequestStatus,
  Conversation,
} from "@/types"
import {
  FormAlert,
  LoadingButton,
  SectionCard,
  StatusBadge,
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
  Field,
  FieldDescription,
  FieldLabel,
  Textarea,
} from "@/components/ui"

export const MY_ADOPTIONS_KEY = ["account", "adoption-requests"] as const
const caseRequestsKey = (caseId: string) =>
  ["cases", "adoption-requests", caseId] as const

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})

const tones: Record<string, "primary" | "success" | "muted" | "danger"> = {
  NEW: "primary",
  CONTACTED: "primary",
  MEETING: "primary",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
}

const actionLabels: Partial<Record<AdoptionRequestStatus, string>> = {
  CONTACTED: "Связался",
  MEETING: "Назначить встречу",
  APPROVED: "Одобрить",
  REJECTED: "Отклонить",
}

export function AdoptionStatusBadge({
  status,
  forApplicant = false,
}: {
  status: string
  forApplicant?: boolean
}) {
  return (
    <StatusBadge tone={tones[status] ?? "muted"}>
      {adoptionStatusLabel(status, forApplicant)}
    </StatusBadge>
  )
}

/** Confirmation for withdrawing an own request; used on the case and in the list. */
export function useCancelAdoption(caseId?: string) {
  const client = useQueryClient()
  const [request, setRequest] = useState<AdoptionRequest | null>(null)
  const [busy, setBusy] = useState(false)
  async function confirm() {
    if (!request || busy) return
    setBusy(true)
    try {
      await adoptionApi.cancel(request.id)
      toast.success("Заявка отозвана")
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось отозвать заявку."))
    } finally {
      setBusy(false)
      setRequest(null)
      void client.invalidateQueries({ queryKey: MY_ADOPTIONS_KEY })
      // The chat may close when nothing else is active on the case.
      void client.invalidateQueries({ queryKey: ["chat"] })
      if (caseId)
        void client.invalidateQueries({
          queryKey: ["cases", "history", caseId],
        })
    }
  }
  const dialog = (
    <AlertDialog
      open={!!request}
      onOpenChange={(open) => !open && !busy && setRequest(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отозвать заявку?</AlertDialogTitle>
          <AlertDialogDescription>
            Автор получит уведомление. Позже можно будет подать новую заявку.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {busy ? "Отзываем…" : "Отозвать"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return { ask: setRequest, dialog }
}

/**
 * Applicant's part: «Хочу забрать домой» with the form, or the active own
 * request with its status and «Отозвать». Guests are sent to sign in.
 */
export function ApplicantAdoption({
  caseId,
  signedIn,
  canApply,
}: {
  caseId: string
  signedIn: boolean
  /** OPEN case with an ADOPTION need that is not closed. */
  canApply: boolean
}) {
  const mine = useQuery({
    queryKey: [...MY_ADOPTIONS_KEY, "all"],
    queryFn: ({ signal }) => adoptionApi.my(undefined, 0, 100, signal),
    enabled: signedIn,
  })
  const active = mine.data?.content.find(
    (item) => item.animalCase.id === caseId && isActiveAdoption(item.status),
  )
  const cancel = useCancelAdoption(caseId)
  const [open, setOpen] = useState(false)

  if (active)
    return (
      <SectionCard icon={House} title="Ваша заявка на дом" fullWidthBody>
        <div id="adoption" className="flex scroll-mt-24 flex-col gap-3">
          <span className="flex flex-wrap items-center gap-2">
            <AdoptionStatusBadge status={active.status} forApplicant />
            <time
              dateTime={active.createdAt}
              className="text-xs text-foreground/60"
            >
              {dateFormat.format(new Date(active.createdAt))}
            </time>
          </span>
          <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">
            {active.message}
          </p>
          <Button
            variant="outline"
            className="h-11 self-start sm:h-10"
            onClick={() => cancel.ask(active)}
          >
            Отозвать заявку
          </Button>
        </div>
        {cancel.dialog}
      </SectionCard>
    )
  if (!canApply) return null
  return (
    <SectionCard
      icon={House}
      title="Ищет постоянный дом"
      description="Готовы забрать животное к себе? Отправьте заявку — автор свяжется с вами."
      fullWidthBody
    >
      <div id="adoption" className="scroll-mt-24">
        {signedIn ? (
          <Button className="h-11 sm:h-10" onClick={() => setOpen(true)}>
            <House aria-hidden />
            Хочу забрать домой
          </Button>
        ) : (
          <Button asChild className="h-11 sm:h-10">
            <Link href={ROUTES.LOGIN}>Войдите, чтобы забрать домой</Link>
          </Button>
        )}
      </div>
      <AdoptionFormDialog open={open} onOpenChange={setOpen} caseId={caseId} />
    </SectionCard>
  )
}

const filters = [
  ["active", "Активные"],
  ["all", "Все"],
  ["REJECTED", "Отклонённые"],
  ["CANCELLED", "Отозванные"],
] as const

/**
 * «Заявки на дом» for the case author: status filter (active by default),
 * forward-only actions, rejection with confirmation, a link to the chat.
 * `onApproved` offers closing the case with PERMANENT_HOME.
 */
export function AuthorAdoptionRequests({
  caseId,
  chats,
  canManage,
  onApproved,
}: {
  caseId: string
  /** Case conversations by the other participant's user id. */
  chats: Map<string, Conversation>
  /** False while the case cannot change (e.g. hidden or closed). */
  canManage: boolean
  onApproved: () => void
}) {
  const client = useQueryClient()
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("active")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AdoptionRequest | null>(null)
  const requests = useQuery({
    queryKey: caseRequestsKey(caseId),
    queryFn: ({ signal }) =>
      adoptionApi.forCase(caseId, undefined, 0, 100, signal),
  })
  const all = requests.data?.content ?? []
  const shown = all.filter((item) =>
    filter === "all"
      ? true
      : filter === "active"
        ? isActiveAdoption(item.status)
        : item.status === filter,
  )

  async function move(request: AdoptionRequest, status: AdoptionRequestStatus) {
    if (busyId) return
    setBusyId(request.id)
    try {
      await adoptionApi.setStatus(request.id, status)
      if (status === "APPROVED") onApproved()
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось изменить статус заявки."))
    } finally {
      setBusyId(null)
      setRejecting(null)
      void client.invalidateQueries({ queryKey: caseRequestsKey(caseId) })
      void client.invalidateQueries({ queryKey: ["chat"] })
    }
  }

  return (
    <SectionCard icon={House} title="Заявки на дом" fullWidthBody>
      <div id="adoption" className="flex scroll-mt-24 flex-col gap-3">
        <div
          role="tablist"
          aria-label="Какие заявки показать"
          className="flex flex-wrap gap-1.5"
        >
          {filters.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              role="tab"
              size="sm"
              aria-selected={filter === value}
              variant={filter === value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {requests.isError ? (
          <FormAlert
            message={getErrorMessage(
              requests.error,
              "Не удалось загрузить заявки.",
            )}
          />
        ) : !shown.length ? (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            {requests.isPending ? "Загружаем заявки…" : "Заявок нет."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((request) => {
              const chat = chats.get(request.applicant.id)
              return (
                <li
                  key={request.id}
                  className="flex flex-col gap-2 rounded-xl border bg-background/60 p-3 sm:p-4"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      href={ROUTES.USER(request.applicant.id)}
                      className="flex min-w-0 items-center gap-2 font-semibold hover:text-primary hover:underline"
                    >
                      <UserAvatar
                        user={{
                          displayName: request.applicant.displayName,
                          avatarUrl: request.applicant.avatarUrl,
                        }}
                      />
                      {request.applicant.displayName}
                    </Link>
                    <AdoptionStatusBadge status={request.status} />
                    <time
                      dateTime={request.createdAt}
                      className="text-xs text-foreground/60"
                    >
                      {dateFormat.format(new Date(request.createdAt))}
                    </time>
                  </span>
                  <p className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">
                    {request.message}
                  </p>
                  <RequestAnswers request={request} />
                  {canManage && canAskCuratorQuestion(request.status) && (
                    <CuratorQuestionForm
                      request={request}
                      onSaved={() =>
                        void client.invalidateQueries({
                          queryKey: caseRequestsKey(caseId),
                        })
                      }
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {canManage &&
                      nextAdoptionStatuses(request.status).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={
                            status === "REJECTED"
                              ? "outline"
                              : status === "APPROVED"
                                ? "default"
                                : "secondary"
                          }
                          className={
                            status === "REJECTED"
                              ? "text-destructive"
                              : undefined
                          }
                          disabled={!!busyId}
                          onClick={() =>
                            status === "REJECTED"
                              ? setRejecting(request)
                              : void move(request, status)
                          }
                        >
                          {actionLabels[status]}
                        </Button>
                      ))}
                    {chat && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={ROUTES.CHAT(chat.id)}>
                          <MessageCircle aria-hidden />
                          Написать
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <AlertDialog
        open={!!rejecting}
        onOpenChange={(open) => !open && !busyId && setRejecting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить заявку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заявитель получит уведомление, чат с ним закроется, если у него
              нет других откликов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!busyId}
              onClick={(event) => {
                event.preventDefault()
                if (rejecting) void move(rejecting, "REJECTED")
              }}
            >
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}

/** Count of NEW requests for the badge on the author's case card. */
export function useNewAdoptionCount(caseId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...caseRequestsKey(caseId), "new-count"],
    queryFn: ({ signal }) => adoptionApi.forCase(caseId, "NEW", 0, 1, signal),
    enabled,
    select: (page) => page.totalElements,
  })
}

/** The filled questionnaire and the author's recorded follow-up questions. */
function RequestAnswers({ request }: { request: AdoptionRequest }) {
  const rows = questionnaireRows(request.answers)
  const follow = curatorAnswers(request.answers)
  if (!rows.length && !follow.length) return null
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-foreground/60">{label}</dt>
              <dd className="font-medium whitespace-pre-line [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {follow.length > 0 && (
        <section
          aria-label="Уточняющие вопросы"
          className="flex flex-col gap-2"
        >
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground">
              Уточняющие вопросы
            </h4>
            <p className="text-xs text-foreground/60">
              Что вы спросили у заявителя по телефону или в чате и что он
              ответил.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {follow.map((item) => (
              <li
                key={item.key}
                className="rounded-lg border bg-card p-3 text-sm [overflow-wrap:anywhere]"
              >
                <p className="font-semibold whitespace-pre-line">
                  {item.question}
                </p>
                <p className="mt-1 whitespace-pre-line text-foreground/80">
                  {item.answer}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * «Записать вопрос и ответ»: the author asked by phone or in chat and
 * records the answer at once (CONTACTED and MEETING only). The answer
 * replaces the request from the response; a status race gets a toast.
 */
function CuratorQuestionForm({
  request,
  onSaved,
}: {
  request: AdoptionRequest
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  async function submit() {
    if (sending.current) return
    if (!question.trim() || !answer.trim())
      return setError("Заполните вопрос и ответ.")
    setError("")
    sending.current = true
    setBusy(true)
    try {
      await adoptionApi.addAnswer(request.id, question.trim(), answer.trim())
      setQuestion("")
      setAnswer("")
      setOpen(false)
      toast.success("Ответ записан")
      onSaved()
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined
      const text = getErrorMessage(cause, "Не удалось записать ответ.")
      if (code === "ADOPTION_CURATOR_QUESTION_NOT_ALLOWED") {
        // The status changed meanwhile: reload it, the form disappears.
        toast.error(text)
        setOpen(false)
        onSaved()
      } else if (
        code === "NOT_CASE_AUTHOR" ||
        code === "ADOPTION_REQUEST_NOT_FOUND"
      ) {
        toast.error(text)
        setOpen(false)
        onSaved()
      } else setError(text)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  if (!open)
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          Записать вопрос и ответ
        </Button>
        <p className="text-xs text-foreground/60">
          Уточнили детали у заявителя по телефону или в чате? Сохраните вопрос и
          его ответ в заявке.
        </p>
      </div>
    )
  const id = `curator-${request.id}`
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <p className="text-sm text-foreground/70">
        Запишите, о чём вы спросили заявителя и что он ответил. Заявитель запись
        не увидит, она сохранится только в заявке.
      </p>
      <FormAlert message={error} />
      <Field>
        <FieldLabel htmlFor={`${id}-question`}>Вопрос</FieldLabel>
        <Textarea
          id={`${id}-question`}
          className="min-h-16"
          maxLength={CURATOR_QUESTION_MAX}
          value={question}
          placeholder="О чём спросили заявителя"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <FieldDescription className="text-right">
          {question.length} / {CURATOR_QUESTION_MAX}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-answer`}>Ответ</FieldLabel>
        <Textarea
          id={`${id}-answer`}
          className="min-h-20"
          maxLength={CURATOR_ANSWER_MAX}
          value={answer}
          placeholder="Что ответил заявитель"
          onChange={(event) => setAnswer(event.target.value)}
        />
        <FieldDescription className="text-right">
          {answer.length} / {CURATOR_ANSWER_MAX}
        </FieldDescription>
      </Field>
      <div className="flex gap-2">
        <LoadingButton
          size="sm"
          loading={busy}
          loadingText="Записываем…"
          onClick={() => void submit()}
        >
          Записать
        </LoadingButton>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Отмена
        </Button>
      </div>
    </div>
  )
}
