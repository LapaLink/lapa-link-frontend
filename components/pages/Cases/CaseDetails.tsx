"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "cn"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  CircleCheck,
  CircleHelp,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Lock,
  Mail,
  MapPin,
  Mars,
  PawPrint,
  Pencil,
  Venus,
} from "lucide-react"
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
  Conversation,
  HelpApplication,
  HelpApplicationStatus,
  NeedStatus,
} from "@/types"
import {
  FormAlert,
  IconCircle,
  LoadingButton,
  CasePhoto,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
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
import { CaseChat, useCaseConversations } from "./CaseChat"

const needStatusTones = {
  OPEN: "primary",
  ASSIGNED: "success",
  CLOSED: "muted",
} as const satisfies Record<NeedStatus, string>

const responseStatusTones = {
  PENDING: "primary",
  ACCEPTED: "success",
  CANCELLED: "muted",
} as const satisfies Record<HelpApplicationStatus, string>

// Tall enough for a comfortable tap on phones, regular height from sm up.
const touchButton = "h-11 w-full rounded-full px-5 sm:h-10 sm:w-auto"

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
  const [offerNeed, setOfferNeed] = useState<CaseNeed | null>(null)
  const [offerError, setOfferError] = useState("")
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
  const caseChats = useCaseConversations(
    caseId,
    responses.data?.content.map((response) => response.user.id) ?? [],
    isAuthor,
  )

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
      setOfferNeed(null)
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

  function openOffer(need: CaseNeed) {
    setOfferError("")
    setOfferNeed(need)
  }

  async function applyForNeed(need: CaseNeed) {
    setOfferError("")
    const message = messageByNeed[need.id]?.trim()
    if (!message) {
      setOfferError("Напишите короткое сообщение автору: чем можете помочь и как с вами связаться.")
      return
    }
    try {
      await createResponse.mutateAsync({ needId: need.id, message })
    } catch (error) {
      setOfferError(getErrorMessage(error, "Не удалось отправить предложение помощи."))
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
        className="mx-auto flex min-w-0 w-full max-w-4xl flex-col gap-5 sm:gap-6"
      >
        <Skeleton className="h-5 w-40" />
        <div className="flex items-start gap-4 sm:gap-6">
          <Skeleton className="size-20 shrink-0 rounded-full sm:size-28 lg:size-32" />
          <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-28 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
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
  const hasActiveResponse = filterValidTaskRecords(
    myCaseApplications.data?.content ?? [],
  ).some(
    (item) =>
      item.animalCase.id === caseId &&
      (item.status === "PENDING" || item.status === "ACCEPTED"),
  )
  const myCaseApplicationsForNeed = (needId: string) =>
    filterValidTaskRecords(myCaseApplications.data?.content ?? []).filter(
      (item) => item.need.id === needId,
    )
  const hasPhoto = !!animalCase.photoUrl
  const canEdit = isAuthor && animalCase.status === "OPEN"
  const facts = [
    {
      label: "Пол",
      icon:
        animalCase.sex === "MALE"
          ? Mars
          : animalCase.sex === "FEMALE"
            ? Venus
            : CircleHelp,
      value:
        animalCase.sex === "MALE"
          ? "Самец"
          : animalCase.sex === "FEMALE"
            ? "Самка"
            : "Неизвестно",
    },
    {
      label: "Примерный возраст",
      icon: Cake,
      value: animalCase.approximateAge || "Не указан",
    },
    {
      label: "Состояние",
      icon: HeartPulse,
      value: animalCase.condition || "Не указано",
    },
    {
      label: "Город",
      icon: MapPin,
      value: animalCase.cityCode
        ? getCityName(cities.data, animalCase.cityCode, locale)
        : "Не указан",
    },
    {
      label: "Объявление создано",
      icon: CalendarDays,
      value: new Intl.DateTimeFormat("ru-RU").format(
        new Date(animalCase.createdAt),
      ),
    },
  ]

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-4xl flex-col gap-5 [overflow-wrap:anywhere] sm:gap-6">
      <nav
        aria-label="Навигация по объявлению"
        className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm"
      >
        <Link
          href={isAuthor ? ROUTES.MY_CASES : ROUTES.CASES}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-semibold text-primary outline-none transition-colors hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ArrowLeft aria-hidden className="size-4" />
          <span className="sr-only">
            {isAuthor ? "Назад к моим объявлениям: " : "Назад к объявлениям: "}
          </span>
          {animalCase.animalType === "CAT" ? "Кошка" : "Собака"}
        </Link>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <StatusBadge
          tone={animalCase.status === "OPEN" ? "success" : "muted"}
          icon={animalCase.status === "OPEN" ? CircleCheck : Lock}
          className="ml-1"
        >
          {caseStatusLabels[animalCase.status]}
        </StatusBadge>
      </nav>

      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-4 sm:gap-x-6">
        {hasPhoto && (
          <div className="size-20 overflow-hidden rounded-full border-4 border-card bg-card shadow-sm sm:row-span-2 sm:size-28 lg:size-32">
            <CasePhoto
              src={animalCase.photoUrl}
              alt={animalCase.title}
              aspect="aspect-square"
              priority
            />
          </div>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-col items-start gap-2 sm:pt-1",
            !hasPhoto && "col-span-2",
          )}
        >
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">
            {animalCase.title}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Автор: {animalCase.author.displayName || "Пользователь"}
          </p>
          {animalCase.condition && (
            <StatusBadge tone="success" icon={PawPrint} className="text-sm">
              <span className="sr-only">Состояние: </span>
              {animalCase.condition}
            </StatusBadge>
          )}
        </div>
        {canEdit && (
          <div className={cn("col-span-2", hasPhoto && "sm:col-span-1 sm:col-start-2")}>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full sm:h-10 sm:w-fit"
            >
              <Link href={ROUTES.EDIT_CASE(caseId)}>
                <Pencil aria-hidden />
                Редактировать объявление
              </Link>
            </Button>
          </div>
        )}
      </header>

      {typeof animalCase.notificationsEnabled === "boolean" &&
        animalCase.status === "OPEN" && (
          <CaseNotifications
            caseId={caseId}
            enabled={animalCase.notificationsEnabled}
            isAuthor={isAuthor}
          />
        )}
      {user && (
        <CaseChat
          caseId={caseId}
          caseOpen={animalCase.status === "OPEN"}
          isAuthor={isAuthor}
          hasActiveResponse={hasActiveResponse}
          chats={caseChats}
        />
      )}

      <SectionCard icon={PawPrint} title="О животном">
        {animalCase.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] sm:text-base">
            {animalCase.description}
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {facts.map(({ label, icon, value }) => (
            <div key={label} className="flex min-w-0 items-center gap-3">
              <IconCircle icon={icon} tone="muted" size="sm" />
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs font-medium text-muted-foreground">
                  {label}
                </dt>
                <dd className="whitespace-pre-wrap font-semibold [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </SectionCard>

      {isAuthor && animalCase.status === "CLOSED" && (
        <SectionCard icon={Lock} title="Закрытие объявления">
          <div className="flex flex-col gap-2 text-sm">
            {animalCase.closeReason && (
              <p>
                <span className="text-muted-foreground">Причина: </span>
                {getDictionaryName(
                  closeReasons.data,
                  animalCase.closeReason,
                  locale,
                )}
              </p>
            )}
            {animalCase.closeComment && (
              <p className="whitespace-pre-wrap">
                <span className="text-muted-foreground">Комментарий: </span>
                {animalCase.closeComment}
              </p>
            )}
          </div>
        </SectionCard>
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
        <SectionCard
          icon={HandHeart}
          title="Чем можно помочь"
          fullWidthBody
          description={
            isAuthor
              ? "Здесь появляются люди, которые готовы помочь. Выберите помощника и свяжитесь с ним по контактам из его сообщения."
              : "Выберите, с чем можете помочь, и напишите автору. Укажите в сообщении, как с вами связаться — автор увидит его, когда будет выбирать помощника."
          }
        >
          <ul className="flex flex-col gap-3">
            {animalCase.needs.map((need) => {
              const needResponses = responsesByNeed.get(need.id) ?? []
              const needName = getDictionaryName(needTypes.data, need.type, locale)
              return (
                <li
                  key={need.id}
                  className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <IconCircle icon={HeartHandshake} size="sm" />
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                      <h3 className="font-bold leading-snug [overflow-wrap:anywhere]">
                        {needName}
                      </h3>
                      <StatusBadge tone={needStatusTones[need.status]}>
                        {needStatusLabels[need.status]}
                      </StatusBadge>
                    </div>
                  </div>

                  {isAuthor && animalCase.status === "OPEN" && need.status !== "CLOSED" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {need.status === "OPEN" && (
                        <Button
                          variant="outline"
                          className={touchButton}
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
                            className={touchButton}
                            disabled={updateNeedStatus.isPending}
                            onClick={() =>
                              void handleNeedStatusChange(need, "CLOSED")
                            }
                          >
                            Помощь получена
                          </Button>
                          <Button
                            variant="outline"
                            className={touchButton}
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
                    <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Войдите, чтобы предложить помощь и написать автору.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild className="h-11 flex-1 sm:h-10 sm:flex-none">
                          <Link href={ROUTES.LOGIN}>Войти</Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="h-11 flex-1 sm:h-10 sm:flex-none"
                        >
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
                        <div className="rounded-xl bg-muted/60 p-4">
                          <p className="font-semibold">
                            Вы уже предложили здесь помощь.
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Следите за ответом автора в разделе{" "}
                            <Link
                              href={ROUTES.MY_TASKS}
                              className="font-semibold text-primary hover:text-primary-hover hover:underline"
                            >
                              «Мои задачи»
                            </Link>
                            .
                          </p>
                          <ul className="mt-3 space-y-2 text-sm">
                            {myCaseApplicationsForNeed(need.id).map(
                              (application) => (
                                <li
                                  key={application.id}
                                  className="flex flex-col items-start gap-2 rounded-xl border bg-card p-3"
                                >
                                  <StatusBadge
                                    tone={responseStatusTones[application.status]}
                                  >
                                    {responseStatusLabels[application.status]}
                                  </StatusBadge>
                                  <p className="text-muted-foreground [overflow-wrap:anywhere]">
                                    {application.message}
                                  </p>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : (
                        <Button
                          className={touchButton}
                          onClick={() => openOffer(need)}
                        >
                          Предложить помощь
                        </Button>
                      )}
                    </>
                  )}

                  {isAuthor && (
                    <AuthorResponses
                      responses={needResponses}
                      need={need}
                      busy={assignResponse.isPending}
                      canAssign={canAct && need.status === "OPEN"}
                      chats={caseChats.byUser}
                      onAssign={requestAssignment}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}

      <Dialog
        open={!!offerNeed}
        onOpenChange={(open) => {
          if (!open && !createResponse.isPending) setOfferNeed(null)
        }}
      >
        {offerNeed && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {getDictionaryName(needTypes.data, offerNeed.type, locale)}
              </DialogTitle>
              <DialogDescription>
                Расскажите, чем поможете, и обязательно оставьте контакт:
                телефон или Telegram.
              </DialogDescription>
            </DialogHeader>
            <FormAlert message={offerError} />
            <Field>
              <FieldLabel htmlFor="offer-message">Сообщение автору</FieldLabel>
              <Textarea
                id="offer-message"
                autoFocus
                className="min-h-28"
                value={messageByNeed[offerNeed.id] ?? ""}
                onChange={(event) =>
                  setMessageByNeed((current) => ({
                    ...current,
                    [offerNeed.id]: event.target.value,
                  }))
                }
                placeholder="Например: могу отвезти к ветеринару в субботу. Телефон +375 29 000-00-00"
              />
            </Field>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={createResponse.isPending}
                onClick={() => setOfferNeed(null)}
              >
                Отмена
              </Button>
              <LoadingButton
                loading={createResponse.isPending}
                loadingText="Отправляем…"
                onClick={() => void applyForNeed(offerNeed)}
              >
                Отправить
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {isAuthor && animalCase.status === "OPEN" && (
        <SectionCard
          icon={Lock}
          title="Закрыть объявление"
          description="Если животное уже нашло дом или помощь больше не нужна, закройте объявление — оно пропадёт из общего списка."
        >
          <Field>
            <FieldLabel htmlFor="close-reason">Причина закрытия</FieldLabel>
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger id="close-reason">
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
              <FieldLabel htmlFor="close-comment">
                Комментарий (обязательно для этой причины)
              </FieldLabel>
              <Textarea
                id="close-comment"
                value={closeComment}
                onChange={(event) => setCloseComment(event.target.value)}
                placeholder="Опишите детали закрытия объявления"
              />
            </Field>
          )}

          <LoadingButton
            loading={closeCaseMutation.isPending}
            loadingText="Закрываем…"
            disabled={
              !closeReason ||
              (!!selectedReason?.requiresComment && !closeComment.trim())
            }
            className="h-11 w-full px-6 sm:h-10 sm:w-fit"
            onClick={() => void handleCloseCase()}
          >
            Закрыть объявление
          </LoadingButton>
        </SectionCard>
      )}
    </section>
  )
}

function AuthorResponses({
  responses,
  need,
  busy,
  canAssign,
  chats,
  onAssign,
}: {
  responses: HelpApplication[]
  need: CaseNeed
  busy: boolean
  canAssign: boolean
  chats: Map<string, Conversation>
  onAssign: (response: HelpApplication) => void
}) {
  if (!responses.length)
    return (
      <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
        Пока никто не предложил помощь. Мы покажем здесь всех, кто откликнется.
      </p>
    )
  return (
    <ul className="flex flex-col gap-2">
      {responses.map((response) => {
        const name = response.user.displayName || "Пользователь"
        return (
          <li
            key={response.id}
            className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <UserAvatar user={{ displayName: name }} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-semibold [overflow-wrap:anywhere]">{name}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {response.message}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge tone={responseStatusTones[response.status]}>
                    {responseStatusLabels[response.status]}
                  </StatusBadge>
                  <ResponseChatStatus
                    conversation={chats.get(response.user.id)}
                  />
                </div>
              </div>
            </div>
            {canAssign &&
              response.status === "PENDING" &&
              need.status === "OPEN" && (
                <Button
                  disabled={busy}
                  className={touchButton}
                  onClick={() => onAssign(response)}
                >
                  Выбрать помощником
                </Button>
              )}
          </li>
        )
      })}
    </ul>
  )
}

function ResponseChatStatus({
  conversation,
}: {
  conversation: Conversation | undefined
}) {
  if (!conversation) return null
  return (
    <p className="text-xs text-muted-foreground">
      {conversation.status === "ACTIVE" ||
      conversation.status === "CLOSED" ? (
        <Link
          href={ROUTES.CHAT(conversation.id)}
          className="font-semibold text-primary hover:text-primary-hover hover:underline"
        >
          {conversation.status === "ACTIVE" ? "Чат открыт" : "Чат закрыт"}
          {conversation.unreadCount > 0 &&
            ` · непрочитанных: ${conversation.unreadCount}`}
        </Link>
      ) : (
        "Просит открыть чат"
      )}
    </p>
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
    <SectionCard
      icon={Mail}
      title={
        <label htmlFor="case-notifications" className="cursor-pointer">
          Получать уведомления по этому объявлению на email
        </label>
      }
      descriptionId="case-notifications-hint"
      description={
        isAuthor
          ? "Напишем, когда кто-то предложит помощь или отменит своё предложение."
          : "Напишем, когда автор выберет вас помощником, изменит статус просьбы или закроет объявление."
      }
      action={
        <Switch
          id="case-notifications"
          checked={enabled}
          disabled={toggle.isPending}
          aria-describedby="case-notifications-hint"
          onCheckedChange={(next) => toggle.mutate(next)}
        />
      }
    >
      <FormAlert message={error} />
    </SectionCard>
  )
}
