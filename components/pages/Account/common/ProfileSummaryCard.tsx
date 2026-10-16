"use client"

import Link from "next/link"
import type { ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Camera,
  CircleCheck,
  Heart,
  MapPin,
  PawPrint,
  Pencil,
} from "lucide-react"
import { accountApi } from "@/api"
import { useCities, useDictionaryLocale } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName } from "@/lib/dictionaries"
import { queryKeys } from "@/lib/queryKeys"
import type { CurrentUser } from "@/types"
import { FormAlert, UserAvatar } from "@/components/common"
import { Button, Card, CardContent, Skeleton } from "@/components/ui"

const casesWord = new Intl.PluralRules("ru")
const caseForms: Record<string, string> = {
  one: "объявление",
  few: "объявления",
  many: "объявлений",
  other: "объявления",
}

/**
 * Header card of the profile: avatar, name, city and counters (own cases,
 * help in progress, help given), each linking to its list.
 */
export function ProfileSummaryCard({
  user,
  onEdit,
}: {
  user: CurrentUser
  onEdit: () => void
}) {
  const cities = useCities()
  const locale = useDictionaryLocale()
  const cases = useQuery({
    queryKey: queryKeys.myCases(0, 1),
    queryFn: ({ signal }) => accountApi.getCases(0, 1, signal),
  })
  const active = useQuery({
    queryKey: [...queryKeys.myAssignments("ACTIVE"), "count"],
    queryFn: () => accountApi.getAssignments("ACTIVE", 0, 1),
  })
  const completed = useQuery({
    queryKey: [...queryKeys.myAssignments("COMPLETED"), "count"],
    queryFn: () => accountApi.getAssignments("COMPLETED", 0, 1),
  })
  const error = cases.error || active.error || completed.error
  const casesCount = cases.data?.totalElements ?? 0

  const stats: Array<{
    href: string
    icon: ComponentType<{ className?: string }>
    query: { isPending: boolean; isError: boolean }
    value: number | undefined
    label: string
  }> = [
    {
      href: ROUTES.MY_CASES,
      icon: PawPrint,
      query: cases,
      value: cases.data?.totalElements,
      label: caseForms[casesWord.select(casesCount)],
    },
    {
      href: `${ROUTES.MY_TASKS}#active`,
      icon: Heart,
      query: active,
      value: active.data?.totalElements,
      label: "помогаю сейчас",
    },
    {
      href: `${ROUTES.MY_TASKS}#completed`,
      icon: CircleCheck,
      query: completed,
      value: completed.data?.totalElements,
      label: "выполнено",
    },
  ]

  return (
    <Card className="min-w-0">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative shrink-0">
            <UserAvatar user={user} size="profile" />
            <Link
              href="#photo"
              aria-label="Сменить фото"
              className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Camera aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-2xl">
              {user.displayName}
            </p>
            <p className="flex items-center gap-1.5 text-sm">
              <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
              {user.cityCode
                ? getCityName(cities.data, user.cityCode, locale)
                : "Город не указан"}
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-3 divide-x border-t pt-4">
          {stats.map(({ href, icon: Icon, query, value, label }) => (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                className="flex min-h-11 flex-col items-start gap-1 rounded-xl px-2 outline-none transition-colors hover:bg-primary-soft/40 focus-visible:ring-3 focus-visible:ring-ring/40 sm:flex-row sm:items-center sm:gap-3 sm:px-3"
              >
                <Icon aria-hidden className="size-6 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  {query.isPending ? (
                    <Skeleton className="h-7 w-8" />
                  ) : (
                    <span className="text-xl font-extrabold">
                      {query.isError ? "—" : value}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {label}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <FormAlert message={error?.message} />
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          className="h-11 w-full rounded-full bg-primary-soft font-semibold text-primary hover:bg-primary-soft/70 hover:text-primary-hover"
        >
          <Pencil data-icon="inline-start" />
          Редактировать профиль
        </Button>
      </CardContent>
    </Card>
  )
}
