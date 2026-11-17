"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { CloudOff, Heart } from "lucide-react"
import { accountApi, getErrorMessage } from "@/api"
import { useCities, useDictionaryLocale } from "@/hooks"
import { getCityName } from "@/lib/dictionaries"
import { mergeFeedPages } from "@/lib/cases/feed"
import { ROUTES } from "@/lib/constants"
import { queryKeys } from "@/lib/queryKeys"
import {
  EmptyState,
  FormAlert,
  LoadingButton,
  PageHeader,
  RequireAuth,
} from "@/components/common"
import { Button } from "@/components/ui"
import { CaseFeedCard, CaseFeedSkeleton } from "../Cases/CaseFeedCard"

const PAGE_SIZE = 20

/** Saved cases of the signed-in user, newest first. */
export function Favorites() {
  return (
    <RequireAuth
      fallback={<CaseFeedSkeleton />}
      guestMessage="Войдите, чтобы сохранять объявления и видеть их здесь."
    >
      <FavoritesContent />
    </RequireAuth>
  )
}

function FavoritesContent() {
  const cities = useCities()
  const locale = useDictionaryLocale()
  const list = useInfiniteQuery({
    queryKey: queryKeys.favoriteList,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      accountApi.getFavorites(pageParam, PAGE_SIZE, signal),
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
  })
  const items = mergeFeedPages(list.data?.pages ?? [])
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  // Removing cards can empty the loaded pages while more are on the server.
  useEffect(() => {
    if (list.data && !items.length && hasNextPage && !isFetchingNextPage)
      void fetchNextPage()
  }, [list.data, items.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Личный кабинет"
        title="Избранное"
        description="Объявления, которые вы сохранили. Недоступные сейчас вернутся сюда, когда снова появятся."
      />
      {list.isPending ? (
        <CaseFeedSkeleton />
      ) : list.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить избранное">
          <FormAlert
            message={getErrorMessage(
              list.error,
              "Не удалось загрузить избранное.",
            )}
          />
          <Button className="h-11 sm:h-10" onClick={() => void list.refetch()}>
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !items.length && !hasNextPage ? (
        <EmptyState icon={Heart} title="Вы пока ничего не добавили в избранное">
          <Button asChild className="h-11 sm:h-10">
            <Link href={ROUTES.CASES}>Смотреть объявления</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <CaseFeedCard
                key={item.id}
                item={item}
                favorite
                brief
                cityName={getCityName(cities.data, item.cityCode, locale)}
                needTypeName={(code) => code}
              />
            ))}
          </div>
          {hasNextPage && (
            <LoadingButton
              variant="outline"
              className="mx-auto"
              loading={isFetchingNextPage}
              loadingText="Загружаем…"
              onClick={() => void fetchNextPage()}
            >
              Показать ещё
            </LoadingButton>
          )}
        </>
      )}
    </section>
  )
}
