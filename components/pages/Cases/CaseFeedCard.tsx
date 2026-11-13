import Link from "next/link"
import { Clock, Zap } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { formatNeedWindow } from "@/lib/needs"
import type { CaseListItem } from "@/types"
import { Skeleton } from "@/components/ui"
import { CasePhoto } from "@/components/common"

// Need badges beyond this collapse into "+N".
const NEED_BADGES_MAX = 3

const kmFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 })

/** "1,2 км"; empty without a distance. */
export function formatDistance(km: number | null | undefined) {
  return km == null ? "" : `${kmFormat.format(km)} км`
}

/**
 * Feed card (the «Тёплый дом» design): a 4:3 photo with the «Срочно» pill, the
 * title with the distance, «Собака · Город», the open needs as chips (the most
 * urgent first) and the deadline of the most urgent one.
 */
export function CaseFeedCard({
  item,
  cityName,
  needTypeName,
}: {
  item: CaseListItem
  cityName: string
  needTypeName: (code: string) => string
}) {
  const { topNeed } = item
  const urgent = topNeed?.priority === "HIGH"
  const due =
    (topNeed && formatNeedWindow(topNeed.startsAt, topNeed.deadline)) ||
    "без срока"
  const distance = formatDistance(item.distanceKm)
  const needs = [
    ...(topNeed ? [topNeed.type] : []),
    ...(item.openNeedTypes ?? []).filter((code) => code !== topNeed?.type),
  ]
  const hidden = needs.length - NEED_BADGES_MAX
  return (
    <Link
      href={ROUTES.CASE_DETAILS(item.id)}
      className="group flex min-w-0 flex-col gap-3 rounded-[20px] outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <div className="relative overflow-hidden rounded-[20px] [&_img]:transition-transform [&_img]:duration-500 motion-safe:group-hover:[&_img]:scale-[1.03]">
        <CasePhoto src={item.photoUrl} alt={item.title} aspect="aspect-[4/3]" />
        {urgent && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card px-[11px] py-1.5 text-[13px] font-bold text-urgent">
            <Zap aria-hidden className="size-3.5 fill-current" />
            Срочно
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="line-clamp-1 text-lg font-bold [overflow-wrap:anywhere]">
            {item.title}
          </h3>
          {distance && (
            <span className="shrink-0 text-[15px] font-semibold">
              {distance}
            </span>
          )}
        </div>
        <p className="truncate text-[15px] text-muted-foreground">
          {`${item.animalType === "CAT" ? "Кошка" : "Собака"} · ${cityName}`}
        </p>
        {needs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="sr-only">Нужна помощь: </span>
            {needs.slice(0, NEED_BADGES_MAX).map((code) => (
              <span
                key={code}
                className="rounded-full bg-primary-soft px-2.5 py-[5px] text-[13px] font-semibold text-primary"
              >
                {needTypeName(code)}
              </span>
            ))}
            {hidden > 0 && (
              <span className="rounded-full bg-muted px-2.5 py-[5px] text-[13px] font-semibold text-muted-foreground">
                <span className="sr-only">и ещё </span>+{hidden}
              </span>
            )}
          </div>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock aria-hidden className="size-[15px] shrink-0" />
          {due}
        </p>
      </div>
    </Link>
  )
}

/** Loading grid shaped like the feed cards. */
export function CaseFeedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загружаем объявления"
      className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, key) => (
        <div key={key} className="flex min-w-0 flex-col gap-3">
          <Skeleton className="aspect-[4/3] w-full rounded-[20px]" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-6 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  )
}
