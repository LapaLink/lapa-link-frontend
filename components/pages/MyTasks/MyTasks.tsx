"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, casesApi, getErrorMessage } from "@/api"
import { CloudOff, HeartHandshake } from "lucide-react"
import {
  EmptyState,
  FormAlert,
  PageHeader,
  RequireAuth,
  StatusBadge,
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui"
import { useAuth, useDictionaryLocale, useNeedTypes } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getDictionaryName } from "@/lib/dictionaries"
import { normalizeRemoteImageUrl } from "@/lib/images"
import { invalidateTaskData, queryKeys } from "@/lib/queryKeys"
import { filterValidTaskRecords } from "@/lib/tasks"
import { cn } from "@/lib/utils"
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"
import { assignmentStatusLabels, responseStatusLabels } from "../Cases/statusLabels"

type TaskGroupKey = "pending" | "active" | "completed" | "cancelled"

type TaskCardItem = {
  id: string
  caseId: string
  title: string
  photoUrl?: string | null
  needType: string
  status: HelpApplicationStatus | AssignmentStatus
  statusLabel: string
  dateLabel: string
  summary: string
  type: "response" | "assignment"
  needId: string
}

const statusTones = {
  PENDING: "primary",
  ACCEPTED: "success",
  ACTIVE: "primary",
  COMPLETED: "success",
  CANCELLED: "muted",
} as const satisfies Record<HelpApplicationStatus | AssignmentStatus, string>

const TASK_GROUPS: Array<{
  key: TaskGroupKey
  title: string
  description: string
  empty: string
}> = [
  {
    key: "active",
    title: "Я помогаю",
    description:
      "Автор выбрал вас помощником. Договоритесь о деталях, а после помощи отметьте задачу выполненной.",
    empty: "Сейчас вы никому не помогаете. Когда автор выберет вас, задача появится здесь.",
  },
  {
    key: "pending",
    title: "Жду ответа",
    description:
      "Вы предложили помощь — автор объявления ещё не выбрал помощника.",
    empty: "Нет предложений, которые ждут ответа.",
  },
  {
    key: "completed",
    title: "Выполнено",
    description: "Добрые дела, которые вы уже сделали. Спасибо!",
    empty: "Здесь появятся задачи, которые вы выполнили.",
  },
  {
    key: "cancelled",
    title: "Отменено",
    description:
      "Предложения, которые вы отозвали, или задачи, где помощь больше не нужна.",
    empty: "Отменённых задач нет.",
  },
]

function formatDate(value?: string | null) {
  if (!value) return "Дата не указана"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function MyTasks() {
  const { user } = useAuth()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const client = useQueryClient()
  const [pendingTaskAction, setPendingTaskAction] = useState<{
    item: TaskCardItem
    action: "cancel-response" | "complete-task"
    prompt: string
  } | null>(null)
  const [pendingActionError, setPendingActionError] = useState("")
  const [actionInFlight, setActionInFlight] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<TaskGroupKey | null>(null)

  // Profile summary cards link to /my-tasks#<group>; open the matching tab.
  useEffect(() => {
    const selectFromHash = () => {
      const key = window.location.hash.slice(1)
      if (TASK_GROUPS.some((group) => group.key === key))
        setSelectedGroup(key as TaskGroupKey)
    }
    selectFromHash()
    window.addEventListener("hashchange", selectFromHash)
    return () => window.removeEventListener("hashchange", selectFromHash)
  }, [])

  const pendingResponses = useQuery({
    queryKey: queryKeys.myApplications("PENDING"),
    queryFn: () => accountApi.getHelpApplications("PENDING"),
    enabled: !!user,
  })

  const activeAssignments = useQuery({
    queryKey: queryKeys.myAssignments("ACTIVE"),
    queryFn: () => accountApi.getAssignments("ACTIVE"),
    enabled: !!user,
  })

  const completedAssignments = useQuery({
    queryKey: queryKeys.myAssignments("COMPLETED"),
    queryFn: () => accountApi.getAssignments("COMPLETED"),
    enabled: !!user,
  })

  const cancelledResponses = useQuery({
    queryKey: queryKeys.myApplications("CANCELLED"),
    queryFn: () => accountApi.getHelpApplications("CANCELLED"),
    enabled: !!user,
  })

  const cancelledAssignments = useQuery({
    queryKey: queryKeys.myAssignments("CANCELLED"),
    queryFn: () => accountApi.getAssignments("CANCELLED"),
    enabled: !!user,
  })

  const taskGroupsData = useMemo(() => {
    const items: TaskCardItem[] = [
      ...filterValidTaskRecords(pendingResponses.data?.content ?? []).map((item) => ({
        id: item.id,
        caseId: item.animalCase.id,
        title: item.animalCase.title,
        photoUrl: item.animalCase.photoUrl,
        needType: item.need.type,
        status: item.status,
        statusLabel: responseStatusLabels[item.status],
        dateLabel: formatDate(item.createdAt),
        summary:
          item.message && item.message.trim().length > 0
            ? item.message
            : "Сообщение без текста.",
        type: "response" as const,
        needId: item.need.id,
      })),
      ...filterValidTaskRecords(activeAssignments.data?.content ?? []).map((item) => ({
        id: item.id,
        caseId: item.animalCase.id,
        title: item.animalCase.title,
        photoUrl: item.animalCase.photoUrl,
        needType: item.need.type,
        status: item.status,
        statusLabel: assignmentStatusLabels[item.status],
        dateLabel: formatDate(item.updatedAt ?? item.createdAt),
        summary: "Автор выбрал вас помощником. Когда поможете — отметьте задачу выполненной.",
        type: "assignment" as const,
        needId: item.need.id,
      })),
      ...filterValidTaskRecords(completedAssignments.data?.content ?? []).map((item) => ({
        id: item.id,
        caseId: item.animalCase.id,
        title: item.animalCase.title,
        photoUrl: item.animalCase.photoUrl,
        needType: item.need.type,
        status: item.status,
        statusLabel: assignmentStatusLabels[item.status],
        dateLabel: formatDate(item.updatedAt ?? item.createdAt),
        summary: `Выполнено ${formatDate(item.updatedAt ?? item.createdAt)}.`,
        type: "assignment" as const,
        needId: item.need.id,
      })),
      ...filterValidTaskRecords(cancelledResponses.data?.content ?? []).map((item) => ({
        id: item.id,
        caseId: item.animalCase.id,
        title: item.animalCase.title,
        photoUrl: item.animalCase.photoUrl,
        needType: item.need.type,
        status: item.status,
        statusLabel: responseStatusLabels[item.status],
        dateLabel: formatDate(item.createdAt),
        summary: "Предложение отозвано, или помощь больше не нужна.",
        type: "response" as const,
        needId: item.need.id,
      })),
      ...filterValidTaskRecords(cancelledAssignments.data?.content ?? []).map((item) => ({
        id: item.id,
        caseId: item.animalCase.id,
        title: item.animalCase.title,
        photoUrl: item.animalCase.photoUrl,
        needType: item.need.type,
        status: item.status,
        statusLabel: assignmentStatusLabels[item.status],
        dateLabel: formatDate(item.updatedAt ?? item.createdAt),
        summary: "Автор выбрал другого помощника или закрыл объявление.",
        type: "assignment" as const,
        needId: item.need.id,
      })),
    ]

    return TASK_GROUPS.map((group) => ({
      ...group,
      items: items.filter((item) => {
        if (group.key === "pending") return item.type === "response" && item.status === "PENDING"
        if (group.key === "active") return item.type === "assignment" && item.status === "ACTIVE"
        if (group.key === "completed") return item.type === "assignment" && item.status === "COMPLETED"
        return item.status === "CANCELLED"
      }),
    }))
  }, [activeAssignments.data, cancelledAssignments.data, cancelledResponses.data, completedAssignments.data, pendingResponses.data])

  const isLoading =
    pendingResponses.isLoading ||
    activeAssignments.isLoading ||
    completedAssignments.isLoading ||
    cancelledResponses.isLoading ||
    cancelledAssignments.isLoading

  const hasError =
    pendingResponses.isError ||
    activeAssignments.isError ||
    completedAssignments.isError ||
    cancelledResponses.isError ||
    cancelledAssignments.isError

  const queries = [
    pendingResponses,
    activeAssignments,
    completedAssignments,
    cancelledResponses,
    cancelledAssignments,
  ]
  const errorMessage = getErrorMessage(
    queries.find((query) => query.isError)?.error,
    "Не удалось загрузить задачи.",
  )
  const totalItems = taskGroupsData.reduce(
    (sum, group) => sum + group.items.length,
    0,
  )
  const currentGroup =
    taskGroupsData.find((group) => group.key === selectedGroup) ??
    taskGroupsData.find((group) => group.items.length) ??
    taskGroupsData[0]

  const doTaskAction = async () => {
    if (!pendingTaskAction) return
    setActionInFlight(true)
    setPendingActionError("")

    try {
      if (pendingTaskAction.action === "cancel-response") {
        await casesApi.cancelResponse(pendingTaskAction.item.id)
      } else {
        await casesApi.completeAssignment(pendingTaskAction.item.id)
      }
      await invalidateTaskData(client, pendingTaskAction.item.caseId)
      setPendingTaskAction(null)
    } catch (error) {
      setPendingActionError(getErrorMessage(error, "Не удалось выполнить действие."))
    } finally {
      setActionInFlight(false)
    }
  }

  const taskActionForItem = (item: TaskCardItem) => {
    if (item.type === "response" && item.status === "PENDING") {
      return {
        label: "Отозвать предложение",
        action: "cancel-response" as const,
        prompt: `Отозвать предложение помощи «${getDictionaryName(needTypes.data, item.needType, locale)}» в объявлении «${item.title}»? Предложить эту помощь повторно будет нельзя.`,
      }
    }
    if (item.type === "assignment" && item.status === "ACTIVE") {
      return {
        label: "Я помог(ла)",
        action: "complete-task" as const,
        prompt: `Отметить задачу «${getDictionaryName(needTypes.data, item.needType, locale)}» выполненной? Просьба будет закрыта, остальные предложения помощи отменятся. Это действие нельзя отменить.`,
      }
    }
    return null
  }

  return (
    <RequireAuth
      fallback={<MyTasksSkeleton />}
      guestMessage="Войдите, чтобы видеть, кому вы предложили помощь и где вас уже ждут."
    >
      {user && (
        <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6">
          <PageHeader
            eyebrow="Личный кабинет"
            title="Мои задачи"
            description="Здесь видно, кому вы предложили помощь и где вас уже ждут."
            actions={
              <Button asChild variant="outline" className="h-11 sm:h-10">
                <Link href={ROUTES.CASES}>Найти, кому помочь</Link>
              </Button>
            }
          />

          <AlertDialog
            open={!!pendingTaskAction}
            onOpenChange={(open) => {
              if (!open) {
                setPendingTaskAction(null)
                setPendingActionError("")
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingTaskAction?.prompt}
                  {pendingActionError ? <span className="mt-3 block text-destructive">{pendingActionError}</span> : null}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionInFlight}>Отмена</AlertDialogCancel>
                <AlertDialogAction disabled={actionInFlight} onClick={() => void doTaskAction()}>
                  {actionInFlight ? "Подождите…" : "Подтвердить"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <MyTasksSkeleton key={index} compact />
              ))}
            </div>
          ) : hasError ? (
            <EmptyState icon={CloudOff} title="Не получилось загрузить задачи">
              <FormAlert message={errorMessage} />
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => queries.forEach((query) => void query.refetch())}
              >
                Попробовать ещё раз
              </Button>
            </EmptyState>
          ) : !totalItems ? (
            <EmptyState
              icon={HeartHandshake}
              title="Вы ещё никому не предлагали помощь"
              description="Откройте объявление, выберите, с чем можете помочь, и напишите автору. Все ваши предложения и задачи появятся здесь."
            >
              <Button asChild className="h-11 sm:h-10">
                <Link href={ROUTES.CASES}>Посмотреть объявления</Link>
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                role="tablist"
                aria-label="Статус задач"
                className="flex gap-2 overflow-x-auto pb-1"
              >
                {taskGroupsData.map((group) => {
                  const active = group.key === currentGroup.key
                  return (
                    <Button
                      key={group.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      variant={active ? "default" : "outline"}
                      className="h-10 shrink-0 rounded-full px-4"
                      onClick={() => setSelectedGroup(group.key)}
                    >
                      {group.title}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          active
                            ? "bg-primary-foreground/20"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {group.items.length}
                      </span>
                    </Button>
                  )
                })}
              </div>

              <section role="tabpanel" aria-label={currentGroup.title} className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{currentGroup.description}</p>
                {currentGroup.items.length ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {currentGroup.items.map((item) => {
                      const taskAction = taskActionForItem(item)
                      const photo = normalizeRemoteImageUrl(item.photoUrl)
                      return (
                        <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
                          <CardHeader className="flex items-start gap-3 sm:gap-4">
                            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                              {photo ? (
                                <Image
                                  src={photo}
                                  alt={item.title}
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                  {item.title.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                              <p className="text-xs font-semibold text-primary">
                                {getDictionaryName(needTypes.data, item.needType, locale)}
                              </p>
                              <CardTitle className="line-clamp-2 text-base font-bold [overflow-wrap:anywhere]">
                                <Link href={ROUTES.CASE_DETAILS(item.caseId)} className="hover:text-primary hover:underline">
                                  {item.title}
                                </Link>
                              </CardTitle>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <StatusBadge tone={statusTones[item.status]}>
                                  {item.statusLabel}
                                </StatusBadge>
                                <span className="text-xs text-muted-foreground">
                                  {item.dateLabel}
                                </span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-3 text-sm">
                            <p className="line-clamp-3 rounded-xl border bg-background/60 px-3 py-2 text-foreground/90 [overflow-wrap:anywhere]">
                              {item.type === "response" && item.status === "PENDING"
                                ? `Ваше сообщение: ${item.summary}`
                                : item.summary}
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              {taskAction && (
                                <Button
                                  className="h-11 rounded-full px-5 sm:h-10"
                                  variant={taskAction.action === "complete-task" ? "default" : "outline"}
                                  disabled={actionInFlight}
                                  onClick={() => setPendingTaskAction({ item, action: taskAction.action, prompt: taskAction.prompt })}
                                >
                                  {taskAction.label}
                                </Button>
                              )}
                              <Button variant="ghost" className="h-11 rounded-full px-5 sm:h-10" asChild>
                                <Link href={ROUTES.CASE_DETAILS(item.caseId)}>Открыть объявление</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                    {currentGroup.empty}
                  </p>
                )}
              </section>
            </div>
          )}
        </section>
      )}
    </RequireAuth>
  )
}

function MyTasksSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-10 rounded-full" />
      </div>
      {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
        <div key={index} className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-16 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
