"use client"

import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
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
import { cn } from "@/lib/utils"
import { MyCaseCard } from "./common/MyCaseCard"
import { MyCasesSkeleton } from "./common/MyCasesSkeleton"

const steps = [
  "Люди видят ваше объявление и предлагают помощь.",
  "Вы открываете объявление и выбираете помощника.",
  "Когда помощь получена — отмечаете это в объявлении.",
]

// "#drafts" opens the drafts tab, e.g. after saving a draft.
const DRAFTS_HASH = "drafts"

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

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
  const drafts =
    useSyncExternalStore(
      subscribeHash,
      () => window.location.hash.slice(1),
      () => "",
    ) === DRAFTS_HASH
  const status = drafts ? "DRAFT" : undefined
  const cases = useQuery({
    queryKey: queryKeys.myCases(page, 6, status),
    queryFn: ({ signal }) => accountApi.getCases(page, 6, signal, status),
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
      <div
        role="tablist"
        aria-label="Какие объявления показать"
        className="flex w-fit gap-1 rounded-full border bg-card p-1"
      >
        {(
          [
            [false, "Все", "all"],
            [true, "Черновики", DRAFTS_HASH],
          ] as const
        ).map(([value, label, hash]) => (
          // Plain anchors: next/link changes the hash without hashchange.
          <a
            key={label}
            href={`#${hash}`}
            role="tab"
            aria-selected={drafts === value}
            onClick={() => setPage(0)}
            className={cn(
              "flex h-10 items-center rounded-full px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
              drafts === value
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "hover:bg-muted",
            )}
          >
            {label}
          </a>
        ))}
      </div>
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
      ) : !cases.data.content.length && drafts ? (
        <EmptyState
          icon={Megaphone}
          title="Черновиков нет."
          description="Сохраните объявление черновиком, если хотите дописать его позже: его увидите только вы."
        />
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
