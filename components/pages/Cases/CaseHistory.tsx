"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { ApiError, casesApi } from "@/api"
import { describeHistoryEvent, historyActor } from "@/lib/cases"
import { queryKeys } from "@/lib/queryKeys"
import { SectionCard } from "@/components/common"
import { Button, Skeleton } from "@/components/ui"

// The newest events are shown first; older ones fold behind "Показать все".
const VISIBLE_EVENTS = 5

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

/**
 * "История" of a case for its author and users with an active response. The
 * server filters what each of them sees; without access (401/403) the block
 * (or 404 for a hidden case) is hidden quietly.
 */
export function CaseHistory({
  caseId,
  authorId,
  userId,
  needName,
}: {
  caseId: string
  authorId: string
  userId?: string
  /** Need type name for an event's needId. */
  needName: (needId: string | null) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const history = useQuery({
    queryKey: queryKeys.caseHistory(caseId),
    queryFn: ({ signal }) => casesApi.history(caseId, signal),
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403, 404].includes(error.status)) &&
      count < 2,
  })

  if (history.isError || (history.data && !history.data.length)) return null
  const events = history.data ?? []
  const hidden = expanded ? 0 : Math.max(events.length - VISIBLE_EVENTS, 0)
  const shown = events.slice(hidden)

  return (
    <SectionCard icon={History} title="История" fullWidthBody>
      {history.isPending ? (
        <div
          role="status"
          aria-label="Загружаем историю"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {hidden > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 self-start sm:h-9"
              onClick={() => setExpanded(true)}
            >
              Показать все ({events.length})
            </Button>
          )}
          <ol className="relative flex flex-col gap-4 border-l-2 border-foreground/10 pl-5">
            {shown.map((item) => (
              <li key={item.id} className="relative flex flex-col gap-0.5">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-card bg-primary"
                />
                <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                  {describeHistoryEvent(item, needName(item.needId))}
                </p>
                <p className="text-xs text-foreground/60">
                  {historyActor(item, { authorId, userId })} ·{" "}
                  <time dateTime={item.createdAt}>
                    {timeFormat.format(new Date(item.createdAt))}
                  </time>
                </p>
                {item.reason && (
                  <p className="text-sm whitespace-pre-wrap text-foreground/60 [overflow-wrap:anywhere]">
                    Причина: {item.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {expanded && events.length > VISIBLE_EVENTS && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 self-start sm:h-9"
              onClick={() => setExpanded(false)}
            >
              Свернуть
            </Button>
          )}
        </>
      )}
    </SectionCard>
  )
}
