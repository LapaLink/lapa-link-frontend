"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { accountApi } from "@/api"
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
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"
import {
  assignmentStatusLabels,
  responseStatusLabels,
} from "../Cases/statusLabels"
import { normalizeRemoteImageUrl } from "@/lib/images"

type TaskGroupKey =
  | "responses"
  | "assigned"
  | "in_work"
  | "completed"
  | "cancelled"

type TaskCardItem = {
  id: string
  group: TaskGroupKey
  caseId: string
  title: string
  photoUrl?: string | null
  needType: string
  status: HelpApplicationStatus | AssignmentStatus
  statusLabel: string
  dateLabel: string
  summary: string
  type: "response" | "assignment"
}

const TASK_GROUPS: Array<{ key: TaskGroupKey; title: string }> = [
  { key: "responses", title: "Отклики" },
  { key: "assigned", title: "Назначено" },
  { key: "in_work", title: "В работе" },
  { key: "completed", title: "Завершено" },
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
  const [taskStateOverrides, setTaskStateOverrides] = useState<
    Record<string, Partial<TaskCardItem>>
  >({})
  const [pendingTaskAction, setPendingTaskAction] = useState<{
    item: TaskCardItem
    action: "cancel-response" | "start-task" | "complete-task"
    prompt: string
  } | null>(null)

  const helpApplications = useQuery({
    queryKey: ["account", "my-help-applications"],
    queryFn: () => accountApi.getHelpApplications(),
    enabled: !!user,
  })

  const assignments = useQuery({
    queryKey: ["account", "my-assignments"],
    queryFn: () => accountApi.getAssignments(),
    enabled: !!user,
  })

  const taskGroupsData = useMemo(() => {
    const items: TaskCardItem[] = [
      ...(helpApplications.data?.content ?? []).map(
        (item): TaskCardItem => ({
          id: item.id,
          group:
            item.status === "PENDING"
              ? "responses"
              : item.status === "ACCEPTED"
                ? "assigned"
                : "cancelled",
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
          type: "response",
        }),
      ),
      ...(assignments.data?.content ?? []).map(
        (item): TaskCardItem => ({
          id: item.id,
          group:
            item.status === "ACTIVE"
              ? "in_work"
              : item.status === "COMPLETED"
                ? "completed"
                : "cancelled",
          caseId: item.animalCase.id,
          title: item.animalCase.title,
          photoUrl: item.animalCase.photoUrl,
          needType: item.need.type,
          status: item.status,
          statusLabel: assignmentStatusLabels[item.status],
          dateLabel: formatDate(item.updatedAt ?? item.createdAt),
          summary:
            "Задание находится в этом статусе. Подробности доступны в объявлении.",
          type: "assignment",
        }),
      ),
    ].map((item) => {
      const override = taskStateOverrides[`${item.type}:${item.id}`]
      return override ? { ...item, ...override } : item
    })

    return TASK_GROUPS.map((group) => ({
      ...group,
      items: items.filter((item) => item.group === group.key),
    }))
  }, [assignments.data, helpApplications.data, taskStateOverrides])

  const isLoading = helpApplications.isLoading || assignments.isLoading
  const hasError = helpApplications.isError || assignments.isError
  const errorMessage =
    helpApplications.error instanceof Error
      ? helpApplications.error.message
      : assignments.error instanceof Error
        ? assignments.error.message
        : "Не удалось загрузить задачи."

  const taskActionForItem = (item: TaskCardItem) => {
    if (item.type === "response" && item.group === "responses") {
      return {
        label: "Отменить отклик",
        action: "cancel-response" as const,
        prompt: "Отменить отклик на эту потребность?",
      }
    }
    if (item.type === "response" && item.group === "assigned") {
      return {
        label: "Начать выполнение",
        action: "start-task" as const,
        prompt: "Перевести эту задачу в статус «В работе»?",
      }
    }
    if (item.type === "assignment" && item.group === "in_work") {
      return {
        label: "Отметить выполненной",
        action: "complete-task" as const,
        prompt: "Подтвердите завершение этой задачи?",
      }
    }
    return null
  }

  const applyTaskAction = () => {
    if (!pendingTaskAction) return

    const { item, action } = pendingTaskAction
    const key = `${item.type}:${item.id}`

    setTaskStateOverrides((current) => ({
      ...current,
      [key]:
        action === "cancel-response"
          ? {
              group: "cancelled",
              status: "CANCELLED" as const,
              statusLabel: responseStatusLabels.CANCELLED,
            }
          : action === "start-task"
            ? {
                group: "in_work",
                status: "ACCEPTED" as const,
                statusLabel: "В работе",
              }
            : {
                group: "completed",
                status: "COMPLETED" as const,
                statusLabel: assignmentStatusLabels.COMPLETED,
              },
    }))
    setPendingTaskAction(null)
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
              if (!open) setPendingTaskAction(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Подтверждение действия</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingTaskAction?.prompt}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={applyTaskAction}>
                  Подтвердить
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
                          <Card
                            key={`${item.type}-${item.id}`}
                            className="overflow-hidden"
                          >
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
                                  <Link
                                    href={ROUTES.CASE_DETAILS(item.caseId)}
                                    className="hover:underline"
                                  >
                                    {item.title}
                                  </Link>
                                </CardTitle>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {getDictionaryName(
                                    needTypes.data,
                                    item.needType,
                                    locale,
                                  )}
                                </p>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-foreground">
                                  {item.statusLabel}
                                </span>
                                <span>{item.dateLabel}</span>
                              </div>
                              <p className="line-clamp-3 text-foreground/90">
                                {item.summary}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={ROUTES.CASE_DETAILS(item.caseId)}>
                                    Открыть объявление
                                  </Link>
                                </Button>
                                {taskAction && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      setPendingTaskAction({
                                        item,
                                        action: taskAction.action,
                                        prompt: taskAction.prompt,
                                      })
                                    }
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
