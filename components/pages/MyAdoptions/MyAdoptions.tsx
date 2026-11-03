"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CloudOff, House } from "lucide-react"
import { adoptionApi, getErrorMessage } from "@/api"
import { isActiveAdoption } from "@/lib/adoption"
import { ROUTES } from "@/lib/constants"
import type { AdoptionRequestStatus } from "@/types"
import {
  CasePhoto,
  EmptyState,
  FormAlert,
  ListPagination,
  PageHeader,
  RequireAuth,
} from "@/components/common"
import { Button, Skeleton } from "@/components/ui"
import {
  AdoptionStatusBadge,
  MY_ADOPTIONS_KEY,
  useCancelAdoption,
} from "../Cases/Adoption"

const PAGE_SIZE = 20
// "Активные" is a client filter over all requests; the rest ask the server.
const filters: Array<[AdoptionRequestStatus | "all" | "active", string]> = [
  ["all", "Все"],
  ["active", "Активные"],
  ["REJECTED", "Отклонённые"],
  ["CANCELLED", "Отозванные"],
]

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** The user's requests to take an animal home, with status and withdrawal. */
export function MyAdoptions() {
  return (
    <RequireAuth guestMessage="Войдите, чтобы увидеть свои заявки на дом.">
      <MyAdoptionsContent />
    </RequireAuth>
  )
}

function MyAdoptionsContent() {
  const [filter, setFilter] = useState<(typeof filters)[number][0]>("all")
  const [page, setPage] = useState(0)
  const status = filter === "all" || filter === "active" ? undefined : filter
  const requests = useQuery({
    queryKey: [...MY_ADOPTIONS_KEY, filter, page],
    queryFn: ({ signal }) =>
      adoptionApi.my(
        status,
        page,
        filter === "active" ? 100 : PAGE_SIZE,
        signal,
      ),
  })
  const cancel = useCancelAdoption()
  const items = (requests.data?.content ?? []).filter(
    (item) => filter !== "active" || isActiveAdoption(item.status),
  )

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Личный кабинет"
        title="Мои заявки на дом"
        description="Заявки, чтобы забрать животное к себе, и что ответил автор."
      />
      <div
        role="tablist"
        aria-label="Статус заявок"
        className="flex flex-wrap gap-2"
      >
        {filters.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            variant={filter === value ? "default" : "outline"}
            className="h-10 rounded-full px-4"
            onClick={() => {
              setFilter(value)
              setPage(0)
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {requests.isPending ? (
        <div
          role="status"
          aria-label="Загружаем заявки"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : requests.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить заявки">
          <FormAlert
            message={getErrorMessage(
              requests.error,
              "Не удалось загрузить заявки.",
            )}
          />
          <Button variant="outline" onClick={() => void requests.refetch()}>
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !items.length ? (
        <EmptyState
          icon={House}
          title="Заявок нет"
          description="Откройте объявление с потребностью «Постоянный дом» и нажмите «Хочу забрать домой»."
        >
          <Button asChild>
            <Link href={ROUTES.CASES}>Посмотреть объявления</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-2xl border bg-card p-4 shadow-card"
            >
              <span className="size-16 shrink-0 overflow-hidden rounded-xl">
                <CasePhoto
                  src={item.animalCase.photoUrl}
                  alt=""
                  aspect="aspect-square"
                  compact
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                <Link
                  href={ROUTES.CASE_DETAILS(item.animalCase.id)}
                  className="line-clamp-2 font-bold [overflow-wrap:anywhere] hover:text-primary hover:underline"
                >
                  {item.animalCase.title}
                </Link>
                <span className="flex flex-wrap items-center gap-2">
                  <AdoptionStatusBadge status={item.status} forApplicant />
                  <time
                    dateTime={item.createdAt}
                    className="text-xs text-foreground/60"
                  >
                    {dateFormat.format(new Date(item.createdAt))}
                  </time>
                </span>
                <span className="line-clamp-2 text-sm whitespace-pre-line text-foreground/80 [overflow-wrap:anywhere]">
                  {item.message}
                </span>
                {isActiveAdoption(item.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancel.ask(item)}
                  >
                    Отозвать
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {requests.data && filter !== "active" && (
        <ListPagination
          label="Страницы заявок"
          page={page}
          totalPages={requests.data.totalPages}
          busy={requests.isFetching}
          onPageChange={setPage}
        />
      )}
      {cancel.dialog}
    </section>
  )
}
