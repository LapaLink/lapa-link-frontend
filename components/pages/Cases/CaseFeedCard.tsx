import Link from "next/link"
import { ArrowRight, ChevronsUp, MapPin, PawPrint } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { formatNeedWindow } from "@/lib/needs"
import type { CaseListItem } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { CasePhoto, StatusBadge } from "@/components/common"

// Badges beyond this collapse into "+N".
const NEED_BADGES_MAX = 3

const publishedFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
})
const publishedFormatWithYear = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
})
const kmFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 })

/** "26 октября"; the year is added only for earlier years. */
function formatPublished(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return (
    date.getFullYear() === new Date().getFullYear()
      ? publishedFormat
      : publishedFormatWithYear
  ).format(date)
}

/** "1,2 км"; empty without a distance. */
export function formatDistance(km: number | null | undefined) {
  return km == null ? "" : `${kmFormat.format(km)} км`
}

/**
 * Feed card: photo with the animal and "Срочно" badges, title, city and
 * distance, short description, the most urgent need with its deadline and
 * comment, types of the other open needs, publication date.
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
  const deadline =
    topNeed && formatNeedWindow(topNeed.startsAt, topNeed.deadline)
  const distance = formatDistance(item.distanceKm)
  const otherNeeds = (item.openNeedTypes ?? []).filter(
    (code) => code !== topNeed?.type,
  )
  return (
    <Link
      href={ROUTES.CASE_DETAILS(item.id)}
      className="group flex min-w-0 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <Card className="w-full min-w-0 gap-4 border-transparent pt-0 shadow-sm ring-1 ring-foreground/5 transition-shadow group-hover:shadow-md">
        <div className="relative">
          <CasePhoto
            src={item.photoUrl}
            alt={item.title}
            aspect="aspect-[16/10]"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <StatusBadge
              tone="primary"
              icon={PawPrint}
              className="shadow-sm ring-1 ring-card"
            >
              {item.animalType === "CAT" ? "Кошка" : "Собака"}
            </StatusBadge>
            {urgent && (
              <StatusBadge
                icon={ChevronsUp}
                className="bg-primary text-primary-foreground shadow-sm ring-1 ring-card"
              >
                Срочно
              </StatusBadge>
            )}
          </div>
        </div>
        <CardHeader className="gap-2">
          <CardTitle className="line-clamp-2 text-lg font-bold [overflow-wrap:anywhere]">
            {item.title}
          </CardTitle>
          <p className="flex items-center gap-1.5 text-sm text-foreground/75">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {cityName}
            {distance && ` · ${distance}`}
          </p>
          {item.shortDescription && (
            <p className="line-clamp-2 text-sm text-foreground/80 [overflow-wrap:anywhere]">
              {item.shortDescription}
            </p>
          )}
        </CardHeader>
        {(topNeed || otherNeeds.length > 0) && (
          <CardContent className="flex flex-col gap-2.5">
            {topNeed && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">
                    {needTypeName(topNeed.type)}
                  </span>
                  {deadline && (
                    <span
                      className={
                        urgent
                          ? "font-semibold text-primary"
                          : "text-foreground/75"
                      }
                    >
                      {deadline}
                    </span>
                  )}
                </p>
                {topNeed.comment && (
                  <p className="line-clamp-1 text-foreground/75 [overflow-wrap:anywhere]">
                    {topNeed.comment}
                  </p>
                )}
              </div>
            )}
            {otherNeeds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="sr-only">Ещё нужна помощь: </span>
                {otherNeeds.slice(0, NEED_BADGES_MAX).map((code) => (
                  <StatusBadge key={code}>{needTypeName(code)}</StatusBadge>
                ))}
                {otherNeeds.length > NEED_BADGES_MAX && (
                  <StatusBadge>
                    +{otherNeeds.length - NEED_BADGES_MAX}
                  </StatusBadge>
                )}
              </div>
            )}
          </CardContent>
        )}
        <CardContent className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-sm">
          <time dateTime={item.createdAt} className="text-foreground/75">
            {formatPublished(item.createdAt)}
          </time>
          <span className="flex items-center gap-1 font-semibold text-primary">
            Подробнее
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
