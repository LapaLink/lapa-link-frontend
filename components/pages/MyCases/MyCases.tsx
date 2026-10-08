"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { accountApi, getErrorMessage } from "@/api"
import { useCities, useDictionaryLocale } from "@/hooks"
import { getCityName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"
import { queryKeys } from "@/lib/queryKeys"
import { RequireAuth, FormAlert, ListPagination } from "@/components/common"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui"
import { MyCaseCard } from "./common/MyCaseCard"
import { MyCasesSkeleton } from "./common/MyCasesSkeleton"

const steps = [
  "Люди видят ваше объявление и предлагают помощь.",
  "Вы открываете объявление и выбираете помощника.",
  "Когда помощь получена — отмечаете это в объявлении.",
]

export function MyCases() {
  return (
    <RequireAuth
      fallback={<MyCasesSkeleton />}
      guestMessage="Войдите, чтобы увидеть свои объявления и тех, кто предложил помощь."
    >
      <MyCasesContent />
    </RequireAuth>
  )
}

function MyCasesContent() {
  const [page, setPage] = useState(0)
  const cities = useCities()
  const locale = useDictionaryLocale()
  const cases = useQuery({
    queryKey: queryKeys.myCases(page, 6),
    queryFn: ({ signal }) => accountApi.getCases(page, 6, signal),
  })
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Мои объявления
          </h1>
          <p className="text-muted-foreground">
            Объявления, которые вы создали. Здесь видно, кто предложил помощь,
            и можно обновить информацию о животном.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={ROUTES.CREATE_CASE}>
            <Plus data-icon="inline-start" />
            Создать объявление
          </Link>
        </Button>
      </div>
      <ol className="grid gap-3 rounded-2xl bg-secondary p-4 text-sm sm:grid-cols-3 sm:p-5">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-primary">
              {index + 1}
            </span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
      {cases.isPending ? (
        <MyCasesSkeleton />
      ) : cases.isError ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert
            message={getErrorMessage(
              cases.error,
              "Не удалось загрузить объявления.",
            )}
          />
          <Button variant="outline" onClick={() => void cases.refetch()}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : !cases.data.content.length ? (
        <Card>
          <CardHeader>
            <CardTitle>У вас пока нет объявлений.</CardTitle>
            <CardDescription>
              Расскажите о найденном животном — вместе будет проще ему помочь.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href={ROUTES.CREATE_CASE}>Создать объявление</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.data.content.map((item) => (
            <MyCaseCard
              key={item.id}
              item={item}
              city={
                item.cityCode
                  ? getCityName(cities.data, item.cityCode, locale)
                  : "Город не указан"
              }
            />
          ))}
        </div>
      )}
      {cases.data && (
        <ListPagination
          page={page}
          totalPages={cases.data.totalPages}
          busy={cases.isFetching}
          onPageChange={setPage}
        />
      )}
    </section>
  )
}
