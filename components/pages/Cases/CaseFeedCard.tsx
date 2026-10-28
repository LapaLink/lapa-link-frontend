import Link from "next/link"
import {
  CalendarDays,
  ChevronsUp,
  Clock,
  HeartHandshake,
  MapPin,
  PawPrint,
} from "lucide-react"
import { cn } from "cn"
import { ROUTES } from "@/lib/constants"
import { formatNeedWindow } from "@/lib/needs"
import type { CaseListItem, NeedPriority } from "@/types"
import { Skeleton } from "@/components/ui"
import { CasePhoto, StatusBadge } from "@/components/common"

// Badges beyond this collapse into "+N".
const NEED_BADGES_MAX = 2

/** Dot color and label of a need priority; the colors match the map legend. */
export const priorityAppearance: Record<
  NeedPriority,
  { dot: string; label: string }
> = {
  HIGH: { dot: "bg-primary", label: "Высокий приоритет" },
  MEDIUM: { dot: "bg-amber-500", label: "Средний приоритет" },
  LOW: { dot: "bg-slate-500", label: "Низкий приоритет" },
}

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

const DAY_MS = 86_400_000

/** "Сегодня", "Вчера", else "26 октября"; the year only for earlier years. */
function formatPublished(iso: string, now = new Date()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const days = Math.round(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      DAY_MS,
  )
  if (days === 0) return "Сегодня"
  if (days === 1) return "Вчера"
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
 * distance, short description, open need types (the most urgent first), its
 * priority and deadline, publication date.
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
  const hiddenNeeds = otherNeeds.length - NEED_BADGES_MAX
  return (
    <Link
      href={ROUTES.CASE_DETAILS(item.id)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card shadow-card outline-none transition-[box-shadow,transform,border-color] duration-200 hover:border-primary/20 hover:shadow-card-hover focus-visible:ring-3 focus-visible:ring-ring/40 motion-safe:hover:-translate-y-0.5"
    >
      <div className="relative overflow-hidden [&_img]:transition-transform [&_img]:duration-500 motion-safe:group-hover:[&_img]:scale-[1.03]">
        <CasePhoto
          src={item.photoUrl}
          alt={item.title}
          aspect="aspect-[16/10]"
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <StatusBadge
            icon={PawPrint}
            className="bg-card/95 text-foreground shadow-sm backdrop-blur"
          >
            {item.animalType === "CAT" ? "Кошка" : "Собака"}
          </StatusBadge>
          {urgent && (
            <StatusBadge
              icon={ChevronsUp}
              className="bg-primary text-primary-foreground shadow-sm"
            >
              Срочно
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="line-clamp-2 text-lg leading-snug font-bold [overflow-wrap:anywhere]">
            {item.title}
          </h3>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-foreground/70">
            <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {cityName}
              {distance && ` · ${distance}`}
            </span>
          </p>
        </div>
        {item.shortDescription && (
          <p className="line-clamp-2 text-sm leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">
            {item.shortDescription}
          </p>
        )}
        {(topNeed || otherNeeds.length > 0) && (
          <div className="mt-auto flex flex-col gap-2.5 pt-1">
            <div className="flex flex-wrap gap-1.5">
              <span className="sr-only">Нужна помощь: </span>
              {topNeed && (
                <StatusBadge tone="primary" icon={HeartHandshake}>
                  {needTypeName(topNeed.type)}
                </StatusBadge>
              )}
              {otherNeeds.slice(0, NEED_BADGES_MAX).map((code) => (
                <StatusBadge key={code}>{needTypeName(code)}</StatusBadge>
              ))}
              {hiddenNeeds > 0 && (
                <StatusBadge>
                  <span className="sr-only">и ещё </span>+{hiddenNeeds}
                </StatusBadge>
              )}
            </div>
            {deadline && (
              <p
                className={cn(
                  "flex items-center gap-1 text-xs text-foreground/70",
                  urgent && "font-semibold text-primary",
                )}
              >
                <Clock aria-hidden className="size-3.5 shrink-0" />
                {deadline}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.06] px-5 py-3.5 text-sm">
        <span className="flex items-center gap-1.5 text-foreground/70">
          <CalendarDays aria-hidden className="size-4 shrink-0" />
          <span className="sr-only">Опубликовано </span>
          <time dateTime={item.createdAt}>
            {formatPublished(item.createdAt)}
          </time>
        </span>
        {topNeed && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                priorityAppearance[topNeed.priority].dot,
              )}
            />
            {priorityAppearance[topNeed.priority].label}
          </span>
        )}
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
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, key) => (
        <div
          key={key}
          className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card shadow-card"
        >
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-between border-t border-foreground/[0.06] px-5 py-3.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
