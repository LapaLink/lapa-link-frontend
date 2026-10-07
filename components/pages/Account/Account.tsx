"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { accountApi } from "@/api"
import { useAuth, useDictionaryLocale, useNeedTypes } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getDictionaryName } from "@/lib/dictionaries"
import { queryKeys } from "@/lib/queryKeys"
import { filterValidTaskRecords } from "@/lib/tasks"
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"
import { RequireAuth } from "@/components/common"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import {
  responseStatusLabels,
  assignmentStatusLabels,
} from "../Cases/statusLabels"
import { AccountSkeleton, AvatarCard, EmailChangeCard } from "./common"

const helpApplicationStatuses: Array<{
  value: HelpApplicationStatus | "ALL"
  label: string
}> = [
  { value: "ALL", label: "Все статусы" },
  { value: "PENDING", label: "Ожидает решения" },
  { value: "ACCEPTED", label: "Принят" },
  { value: "CANCELLED", label: "Отменён" },
]

const assignmentStatuses: Array<{
  value: AssignmentStatus | "ALL"
  label: string
}> = [
  { value: "ALL", label: "Все статусы" },
  { value: "ACTIVE", label: "В работе" },
  { value: "CANCELLED", label: "Отменено" },
  { value: "COMPLETED", label: "Завершено" },
]

export function Account() {
  const { user } = useAuth()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const [helpStatus, setHelpStatus] = useState<HelpApplicationStatus | "ALL">(
    "ALL",
  )
  const [assignmentStatus, setAssignmentStatus] = useState<
    AssignmentStatus | "ALL"
  >("ALL")

  const helpApplications = useQuery({
    queryKey: ["account", "helpApplications", helpStatus],
    queryFn: () =>
      accountApi.getHelpApplications(
        helpStatus === "ALL" ? undefined : helpStatus,
      ),
    enabled: !!user,
  })

  const assignments = useQuery({
    queryKey: ["account", "assignments", assignmentStatus],
    queryFn: () =>
      accountApi.getAssignments(
        assignmentStatus === "ALL" ? undefined : assignmentStatus,
      ),
    enabled: !!user,
  })

  const helpSummary = useQuery({
    queryKey: queryKeys.myApplications(),
    queryFn: () => accountApi.getHelpApplications(),
    enabled: !!user,
  })

  const assignmentSummary = useQuery({
    queryKey: queryKeys.myAssignments(),
    queryFn: () => accountApi.getAssignments(),
    enabled: !!user,
  })

  const validHelpApplications = filterValidTaskRecords(
    helpApplications.data?.content ?? [],
  )
  const validAssignments = filterValidTaskRecords(
    assignments.data?.content ?? [],
  )
  const validHelpSummary = filterValidTaskRecords(
    helpSummary.data?.content ?? [],
  )
  const validAssignmentSummary = filterValidTaskRecords(
    assignmentSummary.data?.content ?? [],
  )

  const pendingCount = validHelpSummary.filter(
    (item) => item.status === "PENDING",
  ).length
  const activeCount = validAssignmentSummary.filter(
    (item) => item.status === "ACTIVE",
  ).length
  const doneCount = validAssignmentSummary.filter(
    (item) => item.status === "COMPLETED",
  ).length

  return (
    <RequireAuth fallback={<AccountSkeleton />}>
      {user && (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Мой профиль</h1>
            <p className="wrap-break-word text-muted-foreground">
              {user.displayName}, здесь можно обновить фото и почту, а также
              следить за откликами и назначениями.
            </p>
          </div>

          <div className="grid items-start gap-6 md:grid-cols-2">
            <AvatarCard user={user} />
            <EmailChangeCard email={user.email} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Ожидают решения</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm">
                <span>{pendingCount}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${ROUTES.MY_TASKS}?tab=pending`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>В работе</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm">
                <span>{activeCount}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${ROUTES.MY_TASKS}?tab=active`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Выполнено</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm">
                <span>{doneCount}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${ROUTES.MY_TASKS}?tab=completed`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Мои отклики</h2>
                <Select
                  value={helpStatus}
                  onValueChange={(value) =>
                    setHelpStatus(value as HelpApplicationStatus | "ALL")
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {helpApplicationStatuses.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {helpApplications.isLoading ? (
                <p className="text-muted-foreground">Загружаем отклики…</p>
              ) : validHelpApplications.length ? (
                <div className="flex flex-col gap-3">
                  {validHelpApplications.map((item) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <CardTitle>
                          <Link href={ROUTES.CASE_DETAILS(item.animalCase.id)}>
                            {item.animalCase.title}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 text-sm">
                        <p className="text-muted-foreground">
                          {item.animalCase.animalType === "CAT"
                            ? "Кошка"
                            : "Собака"}
                        </p>
                        <p>
                          Потребность:{" "}
                          {getDictionaryName(
                            needTypes.data,
                            item.need.type,
                            locale,
                          )}
                        </p>
                        <p>Статус: {responseStatusLabels[item.status]}</p>
                        <p className="text-muted-foreground">{item.message}</p>
                        <Button variant="outline" asChild>
                          <Link href={ROUTES.CASE_DETAILS(item.animalCase.id)}>
                            Открыть объявление
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Пока нет откликов.</p>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Мои назначения</h2>
                <Select
                  value={assignmentStatus}
                  onValueChange={(value) =>
                    setAssignmentStatus(value as AssignmentStatus | "ALL")
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentStatuses.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assignments.isLoading ? (
                <p className="text-muted-foreground">Загружаем назначения…</p>
              ) : validAssignments.length ? (
                <div className="flex flex-col gap-3">
                  {validAssignments.map((item) => (
                    <Card key={item.id}>
                      <CardHeader>
                        <CardTitle>
                          <Link href={ROUTES.CASE_DETAILS(item.animalCase.id)}>
                            {item.animalCase.title}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 text-sm">
                        <p className="text-muted-foreground">
                          {item.animalCase.animalType === "CAT"
                            ? "Кошка"
                            : "Собака"}{" "}
                          · {item.animalCase.cityCode || "Город не указан"}
                        </p>
                        <p>
                          Потребность:{" "}
                          {getDictionaryName(
                            needTypes.data,
                            item.need.type,
                            locale,
                          )}
                        </p>
                        <p>Статус: {assignmentStatusLabels[item.status]}</p>
                        <Button variant="outline" asChild>
                          <Link href={ROUTES.CASE_DETAILS(item.animalCase.id)}>
                            Открыть объявление
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Пока нет назначений.</p>
              )}
            </section>
          </div>
        </section>
      )}
    </RequireAuth>
  )
}
