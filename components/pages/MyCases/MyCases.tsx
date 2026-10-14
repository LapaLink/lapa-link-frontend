"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CloudOff, ListChecks, Megaphone, Plus } from "lucide-react"
import { accountApi, getErrorMessage } from "@/api"
import { useCities, useDictionaryLocale } from "@/hooks"
import { getCityName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"
import { queryKeys } from "@/lib/queryKeys"
import {
  EmptyState,
  FormAlert,
  IconCircle,
  ListPagination,
  PageHeader,
  RequireAuth,
} from "@/components/common"
import { Button, Card, CardContent } from "@/components/ui"
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
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Личный кабинет"
        title="Мои объявления"
        description="Объявления, которые вы создали. Здесь видно, кто предложил помощь, и можно обновить информацию о животном."
        actions={
          <Button asChild className="h-11 sm:h-10">
            <Link href={ROUTES.CREATE_CASE}>
              <Plus data-icon="inline-start" />
              Создать объявление
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <IconCircle icon={ListChecks} />
          <ol className="grid flex-1 gap-3 text-sm sm:grid-cols-3 sm:gap-4">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {cases.isPending ? (
        <MyCasesSkeleton />
      ) : cases.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить объявления">
          <FormAlert
            message={getErrorMessage(
              cases.error,
              "Не удалось загрузить объявления.",
            )}
          />
          <Button
            variant="outline"
            className="h-11 sm:h-10"
            onClick={() => void cases.refetch()}
          >
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !cases.data.content.length ? (
        <EmptyState
          icon={Megaphone}
          title="У вас пока нет объявлений."
          description="Расскажите о найденном животном — вместе будет проще ему помочь."
        >
          <Button asChild className="h-11 sm:h-10">
            <Link href={ROUTES.CREATE_CASE}>Создать объявление</Link>
          </Button>
        </EmptyState>
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
