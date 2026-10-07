"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, casesApi, getErrorMessage } from "@/api"
import { RequireAuth } from "@/components/common"
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

const TASK_GROUPS: Array<{ key: TaskGroupKey; title: string }> = [
  { key: "pending", title: "Ожидают решения" },
  { key: "active", title: "В работе" },
  { key: "completed", title: "Выполнено" },
  { key: "cancelled", title: "Отменено" },
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
            : "Пользователь оставил комментарий без текста.",
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
        summary: "Вы назначены исполнителем. Когда поможете — отметьте задачу выполненной.",
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
        summary: "Отклик отозван или потребность закрыта.",
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
        summary: "Автор снял вас с задачи или объявление закрыто.",
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

  const errorMessage =
    pendingResponses.error instanceof Error
      ? pendingResponses.error.message
      : activeAssignments.error instanceof Error
        ? activeAssignments.error.message
        : completedAssignments.error instanceof Error
          ? completedAssignments.error.message
          : cancelledResponses.error instanceof Error
            ? cancelledResponses.error.message
            : cancelledAssignments.error instanceof Error
              ? cancelledAssignments.error.message
              : "Не удалось загрузить задачи."

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
        label: "Отозвать отклик",
        action: "cancel-response" as const,
        prompt: `Отозвать отклик на “${getDictionaryName(needTypes.data, item.needType, locale)}” в объявлении “${item.title}”? Откликнуться на эту потребность повторно будет нельзя.`,
      }
    }
    if (item.type === "assignment" && item.status === "ACTIVE") {
      return {
        label: "Отметить выполненной",
        action: "complete-task" as const,
        prompt: `Отметить задачу “${getDictionaryName(needTypes.data, item.needType, locale)}” выполненной? Потребность будет закрыта, остальные отклики на неё отменятся. Действие нельзя отменить.`,
      }
    }
    return null
  }

  return (
    <RequireAuth fallback={<MyTasksSkeleton />}>
      {user && (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Мои задачи</h1>
            <p className="text-muted-foreground">
              Здесь собраны ваши отклики и назначения по объявлениям.
            </p>
          </div>

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
                <AlertDialogTitle>Подтверждение действия</AlertDialogTitle>
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
              {Array.from({ length: 4 }).map((_, index) => (
                <MyTasksSkeleton key={index} compact />
              ))}
            </div>
          ) : hasError ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-5 text-sm text-destructive">
                {errorMessage}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {taskGroupsData.map((group) => (
                <section key={group.key} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{group.title}</h2>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>

                  {group.items.length ? (
                    <div className="flex flex-col gap-3">
                      {group.items.map((item) => {
                        const taskAction = taskActionForItem(item)
                        const photo = normalizeRemoteImageUrl(item.photoUrl)
                        return (
                          <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
                            <CardHeader className="flex-row items-center gap-3 pb-3">
                              <div className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
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
                              <div className="min-w-0 flex-1">
                                <CardTitle className="line-clamp-2 text-base">
                                  <Link href={ROUTES.CASE_DETAILS(item.caseId)} className="hover:underline">
                                    {item.title}
                                  </Link>
                                </CardTitle>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {getDictionaryName(needTypes.data, item.needType, locale)}
                                </p>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-foreground">{item.statusLabel}</span>
                                <span>{item.dateLabel}</span>
                              </div>
                              <p className="line-clamp-3 text-foreground/90">{item.summary}</p>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={ROUTES.CASE_DETAILS(item.caseId)}>Открыть объявление</Link>
                                </Button>
                                {taskAction && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={actionInFlight}
                                    onClick={() => setPendingTaskAction({ item, action: taskAction.action, prompt: taskAction.prompt })}
                                  >
                                    {taskAction.label}
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Нет задач в этой категории.
                    </p>
                  )}
                </section>
              ))}
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
        <div key={index} className="rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}
