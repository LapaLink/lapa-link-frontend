"use client"

import { useState } from "react"
import { cn } from "cn"
import {
  ArrowDown,
  CalendarClock,
  ChevronsUp,
  Equal,
  House,
  TimerOff,
  Truck,
} from "lucide-react"
import { formatNeedWindow, isNeedOverdue } from "@/lib/needs"
import type {
  CaseNeed,
  FosterDetails,
  NeedPriority,
  TransportDetails,
} from "@/types"
import { StatusBadge } from "@/components/common"
import { needPriorityLabels } from "./schemas"

// Urgency is carried by the text and the icon, the tone only supports them.
const priorityBadges = {
  LOW: { tone: "muted", icon: ArrowDown },
  MEDIUM: { tone: "primary", icon: Equal },
  HIGH: { tone: "danger", icon: ChevronsUp },
} as const satisfies Record<NeedPriority, { tone: string; icon: unknown }>

const days = new Intl.PluralRules("ru")
const dayForms: Record<string, string> = {
  one: "день",
  few: "дня",
  many: "дней",
  other: "дня",
}

// Longer comments start collapsed behind "Показать полностью".
const COLLAPSED_COMMENT_LENGTH = 180

/** Priority badge for a need. */
export function NeedPriorityBadge({ priority }: { priority: NeedPriority }) {
  const { tone, icon } = priorityBadges[priority]
  return (
    <StatusBadge tone={tone} icon={icon}>
      {needPriorityLabels[priority]} приоритет
    </StatusBadge>
  )
}

/** Time window of a need with an overdue mark; nothing when no bound is set. */
export function NeedTimeWindow({ need }: { need: CaseNeed }) {
  const timeWindow = formatNeedWindow(need.startsAt, need.deadline)
  if (!timeWindow) return null
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <CalendarClock
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="sr-only">Когда нужна помощь: </span>
      <span className="font-medium">{timeWindow}</span>
      {isNeedOverdue(need) && (
        <StatusBadge tone="danger" icon={TimerOff}>
          Срок истёк
        </StatusBadge>
      )}
    </span>
  )
}

/** Need comment; long ones start collapsed behind "Показать полностью". */
export function NeedComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible =
    comment.length > COLLAPSED_COMMENT_LENGTH || comment.split("\n").length > 3
  return (
    <div className="flex flex-col items-start gap-1 text-sm">
      <p
        className={cn(
          "whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]",
          collapsible && !expanded && "line-clamp-3",
        )}
      >
        {comment}
      </p>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          className="min-h-11 rounded-lg font-semibold text-primary outline-none hover:text-primary-hover hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть" : "Показать полностью"}
        </button>
      )}
    </div>
  )
}

/**
 * Type-specific fields of a need: "Фрунзенский → Заводской" and the cargo for
 * TRANSPORT, "Передержка на 14 дней" and the conditions for FOSTER. Nothing
 * when none are filled.
 */
export function NeedExtraDetails({ need }: { need: CaseNeed }) {
  let icon = Truck
  let summary = ""
  let note: string | undefined
  if (need.type === "TRANSPORT") {
    const { fromArea, toArea, cargo } = (need.details ?? {}) as TransportDetails
    summary =
      fromArea && toArea
        ? `${fromArea} → ${toArea}`
        : fromArea
          ? `Откуда: ${fromArea}`
          : toArea
            ? `Куда: ${toArea}`
            : ""
    note = cargo
  } else if (need.type === "FOSTER") {
    const { periodDays, conditions } = (need.details ?? {}) as FosterDetails
    icon = House
    summary = periodDays
      ? `Передержка на ${periodDays} ${dayForms[days.select(periodDays)]}`
      : ""
    note = conditions
  }
  if (!summary && !note) return null
  const Icon = icon
  return (
    <div className="flex gap-3 rounded-xl bg-muted/60 p-3 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
        {summary && <p className="font-semibold">{summary}</p>}
        {note && (
          <p className="whitespace-pre-wrap text-foreground/80">{note}</p>
        )}
      </div>
    </div>
  )
}
