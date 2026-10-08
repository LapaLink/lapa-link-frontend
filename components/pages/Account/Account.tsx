"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clock3, HeartHandshake, CircleCheck, ArrowRight } from "lucide-react"
import { accountApi } from "@/api"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { queryKeys } from "@/lib/queryKeys"
import type { AssignmentStatus, HelpApplicationStatus } from "@/types"
import { RequireAuth, FormAlert } from "@/components/common"
import { Card, CardContent, Skeleton } from "@/components/ui"
import {
  AccountSkeleton,
  AvatarCard,
  EmailChangeCard,
  ActivityList,
  ProfileCard,
  PasswordChangeCard,
  LanguageCard,
  NotificationsCard,
  SignOutCard,
} from "./common"

const responseOptions = [
  { value: "ALL", label: "Все статусы" },
  { value: "PENDING", label: "Ждёт ответа" },
  { value: "ACCEPTED", label: "Выбран помощником" },
  { value: "CANCELLED", label: "Отменено" },
]
const assignmentOptions = [
  { value: "ALL", label: "Все статусы" },
  { value: "ACTIVE", label: "Помощь в процессе" },
  { value: "COMPLETED", label: "Помощь оказана" },
  { value: "CANCELLED", label: "Отменено" },
]

export function Account() {
  return (
    <RequireAuth
      fallback={<AccountSkeleton />}
      guestMessage="Войдите, чтобы открыть свой профиль."
    >
      <AccountContent />
    </RequireAuth>
  )
}

function AccountContent() {
  const { user } = useAuth()
  const [responsesFilter, setResponsesFilter] = useState({
    status: "ALL",
    page: 0,
  })
  const [assignmentsFilter, setAssignmentsFilter] = useState({
    status: "ALL",
    page: 0,
  })
  const responses = useQuery({
    queryKey: [
      ...queryKeys.myApplications(
        responsesFilter.status === "ALL"
          ? undefined
          : (responsesFilter.status as HelpApplicationStatus),
      ),
      { page: responsesFilter.page, size: 6 },
    ],
    queryFn: () =>
      accountApi.getHelpApplications(
        responsesFilter.status === "ALL"
          ? undefined
          : (responsesFilter.status as HelpApplicationStatus),
        responsesFilter.page,
        6,
      ),
  })
  const assignments = useQuery({
    queryKey: [
      ...queryKeys.myAssignments(
        assignmentsFilter.status === "ALL"
          ? undefined
          : (assignmentsFilter.status as AssignmentStatus),
      ),
      { page: assignmentsFilter.page, size: 6 },
    ],
    queryFn: () =>
      accountApi.getAssignments(
        assignmentsFilter.status === "ALL"
          ? undefined
          : (assignmentsFilter.status as AssignmentStatus),
        assignmentsFilter.page,
        6,
      ),
  })
  const pending = useQuery({
    queryKey: [...queryKeys.myApplications("PENDING"), "count"],
    queryFn: () => accountApi.getHelpApplications("PENDING", 0, 1),
  })
  const active = useQuery({
    queryKey: [...queryKeys.myAssignments("ACTIVE"), "count"],
    queryFn: () => accountApi.getAssignments("ACTIVE", 0, 1),
  })
  const completed = useQuery({
    queryKey: [...queryKeys.myAssignments("COMPLETED"), "count"],
    queryFn: () => accountApi.getAssignments("COMPLETED", 0, 1),
  })
  if (!user) return null
  const summaryError = pending.error || active.error || completed.error
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Личный кабинет</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Мой профиль
        </h1>
        <p className="text-muted-foreground [overflow-wrap:anywhere]">
          {user.displayName}, здесь ваши настройки и история помощи.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Жду ответа",
            icon: Clock3,
            query: pending,
            anchor: "pending",
          },
          {
            title: "Я помогаю",
            icon: HeartHandshake,
            query: active,
            anchor: "active",
          },
          {
            title: "Выполнено",
            icon: CircleCheck,
            query: completed,
            anchor: "completed",
          },
        ].map(({ title, icon: Icon, query, anchor }) => (
          <Link
            key={title}
            href={`${ROUTES.MY_TASKS}#${anchor}`}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Card className="h-full bg-primary/[0.03] transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm text-muted-foreground">{title}</p>
                  {query.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {query.isError ? "—" : query.data.totalElements}
                    </p>
                  )}
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <FormAlert message={summaryError?.message} />
      <div className="grid items-stretch gap-6 md:grid-cols-2">
        <div className="min-w-0 md:relative">
          <ProfileCard user={user} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <AvatarCard user={user} />
          <EmailChangeCard
            email={user.email}
            verified={
              user.emailVerifiedAt === undefined
                ? undefined
                : !!user.emailVerifiedAt
            }
          />
        </div>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <PasswordChangeCard />
        <div className="flex min-w-0 flex-col gap-4">
          <LanguageCard user={user} />
          <NotificationsCard user={user} />
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ActivityList
          title="Мои предложения помощи"
          status={responsesFilter.status}
          options={responseOptions}
          onStatusChange={(status) => setResponsesFilter({ status, page: 0 })}
          items={responses.data?.content ?? []}
          loading={responses.isPending}
          error={responses.error}
          page={responsesFilter.page}
          totalPages={responses.data?.totalPages ?? 0}
          busy={responses.isFetching}
          onPageChange={(page) =>
            setResponsesFilter((current) => ({ ...current, page }))
          }
          empty="Предложений помощи с этим статусом пока нет."
        />
        <ActivityList
          title="Где я помогаю"
          status={assignmentsFilter.status}
          options={assignmentOptions}
          onStatusChange={(status) => setAssignmentsFilter({ status, page: 0 })}
          items={assignments.data?.content ?? []}
          loading={assignments.isPending}
          error={assignments.error}
          page={assignmentsFilter.page}
          totalPages={assignments.data?.totalPages ?? 0}
          busy={assignments.isFetching}
          onPageChange={(page) =>
            setAssignmentsFilter((current) => ({ ...current, page }))
          }
          empty="Задач с этим статусом пока нет."
        />
      </div>
      <SignOutCard />
    </section>
  )
}
