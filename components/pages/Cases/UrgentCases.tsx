"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Siren } from "lucide-react"
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
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id="urgent-cases-title"
        className="flex items-center gap-2 text-xl font-bold"
      >
        <Siren aria-hidden className="size-5 text-primary" />
        Срочные запросы
      </h2>
      {urgent.isPending ? (
        <div
          role="status"
          aria-label="Загружаем срочные запросы"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 rounded-2xl" />
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
        <ul className="flex flex-col gap-3">
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
                  className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/5 outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-1 font-bold [overflow-wrap:anywhere]">
                      {item.title}
                    </span>
                    {(need.comment || item.shortDescription) && (
                      <span className="line-clamp-1 text-sm text-foreground/75 [overflow-wrap:anywhere]">
                        {need.comment || item.shortDescription}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-foreground/75">
                        {meta.join(" · ")}
                      </span>
                      <StatusBadge tone="primary">
                        {needTypeName(need.type)}
                      </StatusBadge>
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-muted/60 p-4 text-sm text-foreground/75">
          Сейчас нет срочных запросов по выбранным фильтрам.
        </p>
      )}
    </section>
  )
}
