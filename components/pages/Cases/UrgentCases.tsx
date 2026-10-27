"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { CircleCheck, Clock, Siren } from "lucide-react"
import { casesApi, getErrorMessage } from "@/api"
import { ROUTES } from "@/lib/constants"
import { formatNeedWindow } from "@/lib/needs"
import type { CaseFeedFilter } from "@/types"
import { Skeleton } from "@/components/ui"
import { FormAlert, StatusBadge } from "@/components/common"
import { formatDistance } from "./CaseFeedCard"

const URGENT_SIZE = 4

/**
 * "Срочные запросы": cases with a HIGH need under the feed filters, nearest
 * deadline first. The HIGH filter also counts ASSIGNED needs, so cases without
 * an open `topNeed` (a helper is already chosen) are left out.
 */
export function UrgentCases({
  filter,
  enabled,
  needTypeName,
}: {
  filter: CaseFeedFilter
  enabled: boolean
  needTypeName: (code: string) => string
}) {
  const urgentFilter: CaseFeedFilter = {
    ...filter,
    priority: "HIGH",
    orderBy: "DEADLINE",
    page: 0,
    size: URGENT_SIZE,
  }
  const urgent = useQuery({
    queryKey: ["cases", "list", "urgent", urgentFilter],
    queryFn: ({ signal }) => casesApi.list(urgentFilter, signal),
    enabled,
  })
  const items = urgent.data?.content.filter((item) => item.topNeed) ?? []

  return (
    <section
      aria-labelledby="urgent-cases-title"
      className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-foreground/[0.07] bg-card p-4 shadow-card sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="urgent-cases-title"
          className="flex items-center gap-2.5 text-lg font-bold"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Siren aria-hidden className="size-4" />
          </span>
          Срочные запросы
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            {items.length}
          </span>
        )}
      </div>
      {urgent.isPending ? (
        <div
          role="status"
          aria-label="Загружаем срочные запросы"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : urgent.isError ? (
        <FormAlert
          message={getErrorMessage(
            urgent.error,
            "Не удалось загрузить срочные запросы.",
          )}
        />
      ) : items.length ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => {
            const need = item.topNeed!
            const meta = [
              formatDistance(item.distanceKm),
              formatNeedWindow(need.startsAt, need.deadline),
            ].filter(Boolean)
            return (
              <li key={item.id}>
                <Link
                  href={ROUTES.CASE_DETAILS(item.id)}
                  className="group relative flex flex-col gap-1.5 rounded-xl border border-foreground/[0.07] py-3 pr-3 pl-4 outline-none transition-colors before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-primary hover:border-primary/25 hover:bg-primary-soft/40 focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 font-bold [overflow-wrap:anywhere]">
                      {item.title}
                    </span>
                    <StatusBadge tone="primary" className="shrink-0">
                      {needTypeName(need.type)}
                    </StatusBadge>
                  </span>
                  {(need.comment || item.shortDescription) && (
                    <span className="line-clamp-1 text-sm text-foreground/75 [overflow-wrap:anywhere]">
                      {need.comment || item.shortDescription}
                    </span>
                  )}
                  {meta.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <Clock aria-hidden className="size-3.5 shrink-0" />
                      {meta.join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-1 items-center gap-3 rounded-xl bg-success/60 p-4 lg:flex-col lg:justify-center lg:text-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-success-foreground shadow-xs">
            <CircleCheck aria-hidden className="size-5" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Срочных запросов нет</span>
            <span className="text-sm text-foreground/75">
              По выбранным фильтрам сейчас нет объявлений с высоким приоритетом.
            </span>
          </span>
        </div>
      )}
    </section>
  )
}
