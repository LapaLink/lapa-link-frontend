"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Clock3, HeartHandshake, CircleCheck, ChevronRight } from "lucide-react"
import { accountApi } from "@/api"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { queryKeys } from "@/lib/queryKeys"
import { RequireAuth, FormAlert, IconCircle } from "@/components/common"
import { Card, CardContent, Skeleton } from "@/components/ui"
import {
  AccountSkeleton,
  AvatarCard,
  EmailChangeCard,
  ProfileCard,
  PasswordChangeCard,
  LanguageCard,
  NotificationsCard,
  DeleteAccountCard,
  HelpOffersCard,
  HomeAreaCard,
} from "./common"

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
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Личный кабинет</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Мой профиль
        </h1>
        <p className="text-muted-foreground [overflow-wrap:anywhere]">
          {user.displayName}, здесь ваши настройки и история помощи.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
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
            className="group rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Card className="h-full transition-colors group-hover:border-primary/30">
              <CardContent className="flex items-center gap-4">
                <IconCircle icon={Icon} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm text-muted-foreground">{title}</p>
                  {query.isPending ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    <p className="text-2xl font-extrabold">
                      {query.isError ? "—" : query.data.totalElements}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <FormAlert message={summaryError?.message} />
      <div className="grid items-start gap-5 sm:gap-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          <ProfileCard user={user} />
          <LanguageCard user={user} />
          <PasswordChangeCard />
        </div>
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          <AvatarCard user={user} />
          <EmailChangeCard
            email={user.email}
            verified={
              user.emailVerifiedAt === undefined
                ? undefined
                : !!user.emailVerifiedAt
            }
          />
          <NotificationsCard user={user} />
        </div>
      </div>
      {/* Anchor for the "укажите домашнюю точку" hint in HelpOffersCard. */}
      <div id="home-area" className="min-w-0 scroll-mt-24">
        <HomeAreaCard user={user} />
      </div>
      {/* Anchor for the "Подходит мне" empty feed link. */}
      <div id="help-offers" className="min-w-0 scroll-mt-24">
        <HelpOffersCard user={user} />
      </div>
      <DeleteAccountCard />
    </section>
  )
}
