"use client"

import { useState } from "react"
import { cn } from "cn"
import {
  ArrowDown,
  CalendarClock,
  ChevronsUp,
  Equal,
  TimerOff,
} from "lucide-react"
import { formatNeedWindow, isNeedOverdue } from "@/lib/needs"
import type { CaseNeed, NeedPriority } from "@/types"
import { StatusBadge } from "@/components/common"
import { needPriorityLabels } from "./schemas"

// Urgency is carried by the text and the icon, the tone only supports them.
const priorityBadges = {
  LOW: { tone: "muted", icon: ArrowDown },
  MEDIUM: { tone: "primary", icon: Equal },
  HIGH: { tone: "danger", icon: ChevronsUp },
} as const satisfies Record<NeedPriority, { tone: string; icon: unknown }>

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

/** Time window, an overdue mark and the comment of a need, shown to everyone. */
export function NeedDetails({ need }: { need: CaseNeed }) {
  const timeWindow = formatNeedWindow(need.startsAt, need.deadline)
  const overdue = isNeedOverdue(need)
  if (!timeWindow && !need.comment) return null
  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      {timeWindow && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CalendarClock
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="sr-only">Когда нужна помощь: </span>
          <span className="font-medium">{timeWindow}</span>
          {overdue && (
            <StatusBadge tone="danger" icon={TimerOff}>
              Срок истёк
            </StatusBadge>
          )}
        </p>
      )}
      {need.comment && <NeedComment comment={need.comment} />}
    </div>
  )
}

function NeedComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible =
    comment.length > COLLAPSED_COMMENT_LENGTH || comment.split("\n").length > 3
  return (
    <div className="flex flex-col items-start gap-1">
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
