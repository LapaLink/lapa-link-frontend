"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { CloudOff, HandHeart, MapPin, Megaphone, UserX } from "lucide-react"
import { ApiError, casesApi, getErrorMessage, usersApi } from "@/api"
import { useAuth, useCities, useDictionaryLocale, useNeedTypes } from "@/hooks"
import { mergeFeedPages } from "@/lib/cases"
import { ROUTES } from "@/lib/constants"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import type { BadgeResponse, PublicProfile } from "@/types"
import {
  BadgeArtwork,
  EmptyState,
  FormAlert,
  LoadingButton,
  RequireAuth,
  SectionCard,
  UserAvatar,
} from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
} from "@/components/ui"
import { CaseFeedCard, CaseFeedSkeleton } from "../Cases/CaseFeedCard"

const CASES_PAGE_SIZE = 6

const monthYear = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
})
const fullDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

/**
 * Public profile of another user: header, counters, badges, active help
 * offers and the open cases. Contacts and exact location are never shown.
 * Nothing is cached in the browser. Your own id leads to the account page.
 */
export function UserProfile({ userId }: { userId: string }) {
  return (
    <RequireAuth guestMessage="Войдите, чтобы посмотреть профиль пользователя.">
      <UserProfileContent userId={userId} />
    </RequireAuth>
  )
}

function UserProfileContent({ userId }: { userId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const isSelf = user?.id === userId
  const profile = useQuery({
    queryKey: ["users", "profile", userId],
    queryFn: ({ signal }) => usersApi.get(userId, signal),
    enabled: !isSelf,
    // A stale answer would hide a changed avatar or a new badge.
    gcTime: 0,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
  })
  useEffect(() => {
    if (isSelf) router.replace(ROUTES.ACCOUNT)
  }, [isSelf, router])

  if (isSelf || profile.isPending) return <ProfileSkeleton />
  if (profile.isError) {
    const missing =
      profile.error instanceof ApiError &&
      (profile.error.code === "USER_NOT_FOUND" || profile.error.status === 404)
    return missing ? (
      <EmptyState icon={UserX} title="Пользователь не найден">
        <Button asChild variant="outline">
          <Link href={ROUTES.CASES}>К объявлениям</Link>
        </Button>
      </EmptyState>
    ) : (
      <EmptyState icon={CloudOff} title="Не получилось загрузить профиль">
        <FormAlert
          message={getErrorMessage(
            profile.error,
            "Не удалось загрузить профиль.",
          )}
        />
        <Button variant="outline" onClick={() => void profile.refetch()}>
          Попробовать ещё раз
        </Button>
      </EmptyState>
    )
  }
  return <ProfileView profile={profile.data} />
}

function ProfileView({ profile }: { profile: PublicProfile }) {
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const { stats } = profile
  const counters: Array<[string, number]> = [
    ["Открытых объявлений", stats.openCases],
    ["Закрытых объявлений", stats.closedCases],
    ["Нашли дом", stats.casesClosedHomeFound],
    ["Помощи оказано", stats.assignmentsCompleted],
    ["Откликов", stats.helpApplications],
    ["Принятых чатов", stats.conversationsAccepted],
  ]
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-foreground/[0.07] bg-card p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
        <UserAvatar
          user={{
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }}
          size="profile"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-2xl font-extrabold [overflow-wrap:anywhere] sm:text-3xl">
            {profile.displayName}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/70">
            {profile.cityName && (
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4 text-primary" />
                {profile.cityName}
              </span>
            )}
            <span>
              На платформе с{" "}
              <time dateTime={profile.registeredAt}>
                {monthYear.format(new Date(profile.registeredAt))}
              </time>
            </span>
          </p>
          {profile.bio && (
            <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">
              {profile.bio}
            </p>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counters.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-2xl border border-foreground/[0.07] bg-card p-4 shadow-card"
          >
            <dd className="text-2xl font-extrabold">{value}</dd>
            <dt className="text-xs text-foreground/70">{label}</dt>
          </div>
        ))}
      </dl>

      {profile.badges.length > 0 && (
        <SectionCard icon={Megaphone} title="Бейджи" fullWidthBody>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {profile.badges.map((badge) => (
              <li key={badge.code}>
                <BadgeTile badge={badge} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {profile.helpOffers.length > 0 && (
        <SectionCard icon={HandHeart} title="Готов помочь" fullWidthBody>
          <ul className="flex flex-col divide-y divide-foreground/[0.06]">
            {profile.helpOffers.map((offer) => (
              <li key={offer.id} className="flex flex-col gap-0.5 py-2.5">
                <span className="font-semibold">
                  {getDictionaryName(needTypes.data, offer.type, locale)}
                  <span className="ml-2 text-sm font-normal text-foreground/70">
                    до {offer.radiusKm} км
                  </span>
                </span>
                {offer.availability && (
                  <span className="text-sm whitespace-pre-line text-foreground/80 [overflow-wrap:anywhere]">
                    {offer.availability}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <AuthorCases userId={profile.id} closedCases={stats.closedCases} />
    </section>
  )
}

/** A badge with its name; a click shows the description and the date. */
function BadgeTile({ badge }: { badge: BadgeResponse }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-col items-center gap-1.5 rounded-xl p-2 text-center outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <BadgeArtwork badge={badge} size={56} />
          <span className="text-xs font-semibold [overflow-wrap:anywhere]">
            {badge.name}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="[overflow-wrap:anywhere]">
        <DialogHeader className="items-center pr-8 text-center sm:items-start sm:text-left">
          <DialogTitle>{badge.name}</DialogTitle>
          <DialogDescription>{badge.description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <BadgeArtwork badge={badge} size={104} />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Получен {fullDate.format(new Date(badge.awardedAt))}
        </p>
      </DialogContent>
    </Dialog>
  )
}

/** Open cases of the user, loaded by cursor; closed ones are only counted. */
function AuthorCases({
  userId,
  closedCases,
}: {
  userId: string
  closedCases: number
}) {
  const locale = useDictionaryLocale()
  const cities = useCities()
  const needTypes = useNeedTypes()
  const cases = useInfiniteQuery({
    queryKey: ["users", "cases", userId],
    queryFn: ({ pageParam, signal }) =>
      casesApi.list(
        { authorId: userId, size: CASES_PAGE_SIZE, cursor: pageParam },
        signal,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    gcTime: 0,
  })
  const items = cases.data ? mergeFeedPages(cases.data.pages) : []
  return (
    <section aria-labelledby="author-cases" className="flex flex-col gap-4">
      <div>
        <h2 id="author-cases" className="text-xl font-bold">
          Объявления
        </h2>
        {closedCases > 0 && (
          <p className="text-sm text-foreground/70">
            Закрытых объявлений: {closedCases}
          </p>
        )}
      </div>
      {cases.isPending ? (
        <CaseFeedSkeleton />
      ) : cases.isError && !items.length ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить объявления">
          <FormAlert
            message={getErrorMessage(
              cases.error,
              "Не удалось загрузить объявления.",
            )}
          />
          <Button variant="outline" onClick={() => void cases.refetch()}>
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !items.length ? (
        <EmptyState icon={Megaphone} title="Открытых объявлений нет" />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <CaseFeedCard
                key={item.id}
                item={item}
                cityName={getCityName(cities.data, item.cityCode, locale)}
                needTypeName={(code) =>
                  getDictionaryName(needTypes.data, code, locale)
                }
              />
            ))}
          </div>
          {cases.hasNextPage && (
            <LoadingButton
              variant="outline"
              className="h-11 self-center px-8 sm:h-10"
              loading={cases.isFetchingNextPage}
              loadingText="Загружаем…"
              onClick={() => void cases.fetchNextPage()}
            >
              Показать ещё
            </LoadingButton>
          )}
        </>
      )}
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загружаем профиль"
      className="mx-auto flex w-full max-w-4xl flex-col gap-5"
    >
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
