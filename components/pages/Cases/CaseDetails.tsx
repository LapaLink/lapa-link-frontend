"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, casesApi, getErrorMessage } from "@/api"
import {
  useAuth,
  useCaseCloseReasons,
  useDictionaryLocale,
  useNeedTypes,
  useCities,
} from "@/hooks"
import { getDictionaryName, getCityName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"

import type {
  CaseDetails as CaseDetailsData,
  CaseNeed,
  HelpApplication,
  NeedStatus,
} from "@/types"
import { FormAlert, LoadingButton, CasePhoto } from "@/components/common"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Skeleton,
  Switch,
} from "@/components/ui"
import {
  caseStatusLabels,
  needStatusLabels,
  responseStatusLabels,
} from "./statusLabels"
import { invalidateTaskData, queryKeys } from "@/lib/queryKeys"
import { filterValidTaskRecords } from "@/lib/tasks"

type CaseDetailsProps = {
  caseId: string
}

export function CaseDetails({ caseId }: CaseDetailsProps) {
  const client = useQueryClient()
  const { user } = useAuth()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const cities = useCities()
  const closeReasons = useCaseCloseReasons()
  const [messageByNeed, setMessageByNeed] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [closeReason, setCloseReason] = useState("")
  const [closeComment, setCloseComment] = useState("")
  const [pendingNeedAction, setPendingNeedAction] = useState<{
    need: CaseNeed
    nextStatus: NeedStatus
    prompt: string
  } | null>(null)
  const [pendingAssignment, setPendingAssignment] =
    useState<HelpApplication | null>(null)

  const details = useQuery({
    queryKey: queryKeys.caseDetail(caseId),
    queryFn: ({ signal }) => casesApi.getById(caseId, signal),
    refetchOnMount: "always",
  })
  const isAuthor = !!user && user.id === details.data?.author?.id
  const responses = useQuery({
    queryKey: queryKeys.caseResponses(caseId),
    queryFn: () => casesApi.getResponses(caseId),
    enabled: isAuthor,
  })

  const myCaseApplications = useQuery({
    queryKey: queryKeys.myApplications(),
    queryFn: () => accountApi.getHelpApplications(),
    enabled: !!user && !isAuthor,
  })

  const refreshCase = () => {
    void invalidateTaskData(client, caseId)
  }

  const createResponse = useMutation({
    mutationFn: ({ needId, message }: { needId: string; message: string }) =>
      casesApi.createResponse(needId, message),
    onSuccess: (_created, variables) => {
      setMessageByNeed((current) => ({ ...current, [variables.needId]: "" }))
      refreshCase()
    },
  })

  const assignResponse = useMutation({
    mutationFn: (responseId: string) => casesApi.assignResponse(responseId),
    onSuccess: refreshCase,
  })

  const updateNeedStatus = useMutation({
    mutationFn: ({ needId, status }: { needId: string; status: NeedStatus }) =>
      casesApi.updateNeedStatus(caseId, needId, status),
    onSuccess: refreshCase,
  })

  const closeCaseMutation = useMutation({
    mutationFn: ({ reason, comment }: { reason: string; comment?: string }) =>
      casesApi.close(caseId, reason, comment),
    onSuccess: () => {
      setCloseReason("")
      setCloseComment("")
      refreshCase()
    },
  })

  async function applyForNeed(need: CaseNeed) {
    setError("")
    const message = messageByNeed[need.id]?.trim()
    if (!message) {
      setError("Напишите короткое сообщение автору: чем можете помочь и как с вами связаться.")
      return
    }
    try {
      await createResponse.mutateAsync({ needId: need.id, message })
    } catch (error) {
      setError(getErrorMessage(error, "Не удалось отправить предложение помощи."))
    }
  }

  async function assign(application: HelpApplication) {
    setError("")
    try {
      await assignResponse.mutateAsync(application.id)
    } catch (error) {
      setError(getErrorMessage(error, "Не удалось выбрать помощника."))
    } finally {
      setPendingAssignment(null)
    }
  }

  async function requestAssignment(application: HelpApplication) {
    setError("")
    setPendingAssignment(application)
  }

  async function commitNeedStatusChange(
    need: CaseNeed,
    nextStatus: NeedStatus,
  ) {
    setError("")
    try {
      await updateNeedStatus.mutateAsync({
        needId: need.id,
        status: nextStatus,
      })
    } catch (error) {
      setError(getErrorMessage(error, "Не удалось изменить статус."))
    } finally {
      setPendingNeedAction(null)
    }
  }

  async function handleNeedStatusChange(
    need: CaseNeed,
    nextStatus: NeedStatus,
  ) {
    if (nextStatus === "ASSIGNED") return

    const transition = `${need.status}->${nextStatus}`
    const needResponses = responses.data?.content.filter(
      (response) => response.needId === need.id,
    )
    const countPending =
      needResponses?.filter((response) => response.status === "PENDING")
        .length ?? 0
    const acceptedRequest = needResponses?.find(
      (response) => response.status === "ACCEPTED",
    )

    const prompt =
      transition === "OPEN->CLOSED"
        ? `Отметить, что эта помощь больше не нужна? Все предложения помощи, которые ждут ответа (${countPending}), будут отменены. Вернуть эту просьбу будет нельзя.`
        : transition === "ASSIGNED->OPEN"
          ? `Отменить выбор помощника ${acceptedRequest?.user.displayName || ""}? Просьба снова станет открытой, и вы сможете выбрать другого из тех, кто предложил помощь.`
          : transition === "ASSIGNED->CLOSED"
            ? `Подтвердить, что ${acceptedRequest?.user.displayName || "помощник"} помог(ла)? Просьба будет закрыта, остальные предложения помощи (${countPending}) отменятся.`
            : undefined
    if (prompt) {
      setPendingNeedAction({ need, nextStatus, prompt })
      return
    }

    await commitNeedStatusChange(need, nextStatus)
  }

  async function handleCloseCase() {
    setError("")
    if (!closeReason) {
      setError("Выберите причину закрытия объявления.")
      return
    }

    const reason = closeReasons.data?.find((item) => item.code === closeReason)
    if (reason?.requiresComment && !closeComment.trim()) {
      setError("Для этой причины нужно указать комментарий.")
      return
    }

    try {
      await closeCaseMutation.mutateAsync({
        reason: closeReason,
        comment: closeComment.trim() || undefined,
      })
    } catch (error) {
      setError(getErrorMessage(error, "Не удалось закрыть объявление."))
    }
  }

  if (details.isLoading || (details.data && !details.data.author && !details.error))
    return (
      <div
        role="status"
        aria-label="Загружаем объявление"
        className="mx-auto flex min-w-0 w-full max-w-4xl flex-col gap-6"
      >
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  if (details.error)
    return (
      <FormAlert
        message={
          details.error instanceof Error
            ? details.error.message
            : "Не удалось загрузить объявление."
        }
      />
    )
  if (!details.data) return null

  const animalCase = details.data

  const canAct = animalCase.status === "OPEN"
  const selectedReason = closeReasons.data?.find(
    (reason) => reason.code === closeReason,
  )
  const responsesByNeed = new Map<string, HelpApplication[]>()
  responses.data?.content.forEach((response) => {
    responsesByNeed.set(response.needId, [
      ...(responsesByNeed.get(response.needId) ?? []),
      response,
    ])
  })
  const myCaseApplicationsForNeed = (needId: string) =>
    filterValidTaskRecords(myCaseApplications.data?.content ?? []).filter(
      (item) => item.need.id === needId,
    )

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-4xl flex-col gap-6 [overflow-wrap:anywhere]">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl">
          <CasePhoto
            src={animalCase.photoUrl}
            alt={animalCase.title}
            priority
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">
            {animalCase.animalType === "CAT" ? "Кошка" : "Собака"} ·{" "}
            {caseStatusLabels[animalCase.status]}
          </p>
          <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            {animalCase.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Автор: {animalCase.author.displayName || "Пользователь"}
          </p>
          {animalCase.description && (
            <p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
              {animalCase.description}
            </p>
          )}
        </div>
      </div>

      {isAuthor && animalCase.status === "OPEN" && (
        <Button asChild variant="outline" className="w-full sm:w-fit">
          <Link href={ROUTES.EDIT_CASE(caseId)}>Редактировать объявление</Link>
        </Button>
      )}
      {typeof animalCase.notificationsEnabled === "boolean" &&
        animalCase.status === "OPEN" && (
          <CaseNotifications
            caseId={caseId}
            enabled={animalCase.notificationsEnabled}
            isAuthor={isAuthor}
          />
        )}
      <Card>
        <CardHeader>
          <CardTitle>О животном</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              [
                "Пол",
                animalCase.sex === "MALE"
                  ? "Самец"
                  : animalCase.sex === "FEMALE"
                    ? "Самка"
                    : "Неизвестно",
              ],
              ["Примерный возраст", animalCase.approximateAge || "Не указан"],
              ["Состояние", animalCase.condition || "Не указано"],
              [
                "Город",
                animalCase.cityCode
                  ? getCityName(cities.data, animalCase.cityCode, locale)
                  : "Не указан",
              ],
              [
                "Объявление создано",
                new Intl.DateTimeFormat("ru-RU").format(
                  new Date(animalCase.createdAt),
                ),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col gap-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {isAuthor && animalCase.status === "CLOSED" && (
        <Card>
          <CardHeader>
            <CardTitle>Закрытие объявления</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {animalCase.closeReason && (
              <p>
                Причина:{" "}
                {getDictionaryName(
                  closeReasons.data,
                  animalCase.closeReason,
                  locale,
                )}
              </p>
            )}
            {animalCase.closeComment && (
              <p>Комментарий: {animalCase.closeComment}</p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!pendingNeedAction}
        onOpenChange={(open) => {
          if (!open) setPendingNeedAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingNeedAction?.prompt}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingNeedAction) return
                void commitNeedStatusChange(
                  pendingNeedAction.need,
                  pendingNeedAction.nextStatus,
                )
              }}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingAssignment}
        onOpenChange={(open) => {
          if (!open) setPendingAssignment(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выбрать помощника</AlertDialogTitle>
            <AlertDialogDescription>
              Выбрать {pendingAssignment?.user.displayName || "этого человека"}{" "}
              помощником? Свяжитесь с ним по контактам из его сообщения и
              договоритесь о деталях.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingAssignment) return
                void assign(pendingAssignment)
              }}
            >
              Выбрать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormAlert message={error} />


      {animalCase.needs.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight">
            Чем можно помочь
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAuthor
              ? "Здесь появляются люди, которые готовы помочь. Выберите помощника и свяжитесь с ним по контактам из его сообщения."
              : "Выберите, с чем можете помочь, и напишите автору. Укажите в сообщении, как с вами связаться — автор увидит его, когда будет выбирать помощника."}
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {animalCase.needs.map((need) => {
          const needResponses = responsesByNeed.get(need.id) ?? []
          return (
            <Card key={need.id}>
              <CardHeader>
                <CardTitle>
                  {getDictionaryName(needTypes.data, need.type, locale)}
                </CardTitle>
                <CardDescription>
                  {needStatusLabels[need.status]}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isAuthor && animalCase.status === "OPEN" && (
                  <div className="flex flex-wrap gap-2">
                    {need.status === "OPEN" && (
                      <Button
                        variant="outline"
                        disabled={updateNeedStatus.isPending}
                        onClick={() =>
                          void handleNeedStatusChange(need, "CLOSED")
                        }
                      >
                        Помощь больше не нужна
                      </Button>
                    )}
                    {need.status === "ASSIGNED" && (
                      <>
                        <Button
                          variant="default"
                          disabled={updateNeedStatus.isPending}
                          onClick={() =>
                            void handleNeedStatusChange(need, "CLOSED")
                          }
                        >
                          Помощь получена
                        </Button>
                        <Button
                          variant="outline"
                          disabled={updateNeedStatus.isPending}
                          onClick={() =>
                            void handleNeedStatusChange(need, "OPEN")
                          }
                        >
                          Выбрать другого помощника
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {!isAuthor && canAct && !user && need.status === "OPEN" && (
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Войдите, чтобы предложить помощь и написать автору.
                    </p>
                    <div className="flex gap-2">
                      <Button asChild size="sm">
                        <Link href={ROUTES.LOGIN}>Войти</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={ROUTES.REGISTER}>Регистрация</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {!isAuthor &&
                  canAct &&
                  user &&
                  (need.status === "OPEN" ||
                    myCaseApplicationsForNeed(need.id).length > 0) && (
                  <>
                    {myCaseApplicationsForNeed(need.id).length ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="font-medium">
                          Вы уже предложили здесь помощь.
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Следите за ответом автора в разделе{" "}
                          <Link
                            href={ROUTES.MY_TASKS}
                            className="font-medium text-primary hover:underline"
                          >
                            «Мои задачи»
                          </Link>
                          .
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {myCaseApplicationsForNeed(need.id).map(
                            (application) => (
                              <li
                                key={application.id}
                                className="rounded-md border bg-background p-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>
                                    {responseStatusLabels[application.status]}
                                  </span>
                                </div>
                                <p className="mt-1 [overflow-wrap:anywhere]">
                                  {application.message}
                                </p>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <Field>
                          <FieldLabel htmlFor={`message-${need.id}`}>
                            Сообщение автору
                          </FieldLabel>
                          <FieldDescription>
                            Расскажите, чем поможете, и обязательно оставьте
                            контакт: телефон или Telegram.
                          </FieldDescription>
                          <Textarea
                            id={`message-${need.id}`}
                            value={messageByNeed[need.id] ?? ""}
                            onChange={(event) =>
                              setMessageByNeed((current) => ({
                                ...current,
                                [need.id]: event.target.value,
                              }))
                            }
                            placeholder="Например: могу отвезти к ветеринару в субботу. Телефон +375 29 000-00-00"
                          />
                        </Field>
                        <LoadingButton
                          loading={createResponse.isPending}
                          loadingText="Отправляем…"
                          onClick={() => void applyForNeed(need)}
                        >
                          Предложить помощь
                        </LoadingButton>
                      </div>
                    )}
                  </>
                )}

                {isAuthor && (
                  <AuthorResponses
                    responses={needResponses}
                    need={need}
                    busy={assignResponse.isPending}
                    canAssign={canAct && need.status === "OPEN"}
                    onAssign={requestAssignment}
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isAuthor && animalCase.status === "OPEN" && (
        <Card>
          <CardHeader>
            <CardTitle>Закрыть объявление</CardTitle>
            <CardDescription>
              Если животное уже нашло дом или помощь больше не нужна, закройте
              объявление — оно пропадёт из общего списка.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Причина закрытия</FieldLabel>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите причину" />
                </SelectTrigger>
                <SelectContent>
                  {closeReasons.data?.map((reason) => (
                    <SelectItem key={reason.code} value={reason.code}>
                      {reason.nameRu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {selectedReason?.requiresComment && (
              <Field>
                <FieldLabel>Комментарий (обязательно для этой причины)</FieldLabel>
                <Textarea
                  value={closeComment}
                  onChange={(event) => setCloseComment(event.target.value)}
                  placeholder="Опишите детали закрытия объявления"
                />
              </Field>
            )}

            <LoadingButton
              variant="destructive"
              loading={closeCaseMutation.isPending}
              loadingText="Закрываем…"
              disabled={
                !closeReason ||
                (!!selectedReason?.requiresComment && !closeComment.trim())
              }
              className="w-full sm:w-fit"
              onClick={() => void handleCloseCase()}
            >
              Закрыть объявление
            </LoadingButton>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function AuthorResponses({
  responses,
  need,
  busy,
  canAssign,
  onAssign,
}: {
  responses: HelpApplication[]
  need: CaseNeed
  busy: boolean
  canAssign: boolean
  onAssign: (response: HelpApplication) => void
}) {
  if (!responses.length)
    return (
      <p className="text-sm text-muted-foreground">
        Пока никто не предложил помощь. Мы покажем здесь всех, кто откликнется.
      </p>
    )
  return (
    <div className="flex flex-col gap-3">
      {responses.map((response) => (
        <div
          key={response.id}
          className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {response.user.displayName || "Пользователь"}
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {response.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {responseStatusLabels[response.status]}
            </p>
          </div>
          {canAssign &&
            response.status === "PENDING" &&
            need.status === "OPEN" && (
              <Button
                disabled={busy}
                className="shrink-0"
                onClick={() => onAssign(response)}
              >
                Выбрать помощником
              </Button>
            )}
        </div>
      ))}
    </div>
  )
}

/** Per-case email notification switch for the author or a user who offered help. */
function CaseNotifications({
  caseId,
  enabled,
  isAuthor,
}: {
  caseId: string
  enabled: boolean
  isAuthor: boolean
}) {
  const client = useQueryClient()
  const [error, setError] = useState("")
  const setEnabled = (value: boolean) =>
    client.setQueryData<CaseDetailsData>(
      queryKeys.caseDetail(caseId),
      (current) => current && { ...current, notificationsEnabled: value },
    )
  const toggle = useMutation({
    mutationFn: (next: boolean) => casesApi.setNotifications(caseId, next),
    onMutate: async (next) => {
      setError("")
      await client.cancelQueries({ queryKey: queryKeys.caseDetail(caseId) })
      setEnabled(next)
    },
    onSuccess: (result) => setEnabled(result.enabled),
    onError: (mutationError, next) => {
      setEnabled(!next)
      setError(
        getErrorMessage(
          mutationError,
          "Не удалось сохранить настройку уведомлений.",
        ),
      )
    },
  })
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="case-notifications" className="font-semibold">
              Получать уведомления по этому объявлению на email
            </FieldLabel>
            <p
              id="case-notifications-hint"
              className="text-sm text-muted-foreground"
            >
              {isAuthor
                ? "Напишем, когда кто-то предложит помощь или отменит своё предложение."
                : "Напишем, когда автор выберет вас помощником, изменит статус просьбы или закроет объявление."}
            </p>
          </div>
          <Switch
            id="case-notifications"
            checked={enabled}
            disabled={toggle.isPending}
            aria-describedby="case-notifications-hint"
            onCheckedChange={(next) => toggle.mutate(next)}
          />
        </div>
        <FormAlert message={error} />
      </CardContent>
    </Card>
  )
}
