"use client"

import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { moderationApi, getErrorMessage } from "@/api"
import { useAuth } from "@/hooks"
import {
  canModerate,
  reportStatusLabels,
  reportTargetLabels,
} from "@/lib/moderation"
import { queryKeys } from "@/lib/queryKeys"
import type { ModerationFilter } from "@/types"
import {
  EmptyState,
  FormAlert,
  ListPagination,
  PageHeader,
  RequireAuth,
} from "@/components/common"
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ui"
import { ReportDetails } from "./common/ReportDetails"

export function ModerationReports() {
  return (
    <RequireAuth>
      <Reports />
    </RequireAuth>
  )
}

function Reports() {
  const { user } = useAuth()
  const allowed = canModerate(user)
  const [filter, setFilter] = useState<ModerationFilter>({
    page: 0,
    status: "NEW",
  })
  const [reportId, setReportId] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const reports = useQuery({
    queryKey: queryKeys.moderationReports(filter),
    queryFn: ({ signal }) => moderationApi.list(filter, signal),
    enabled: allowed,
  })
  if (!allowed)
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Раздел для модераторов"
        description="У вашего аккаунта нет доступа к рассмотрению жалоб."
      />
    )

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5">
      <PageHeader
        eyebrow="Безопасность сообщества"
        title="Жалобы"
        description="Проверьте обращение, изучите объект и примите решение. Сначала показаны самые старые обращения."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ReportFilter
          label="Статус жалобы"
          value={filter.status ?? "all"}
          values={reportStatusLabels}
          onChange={(value) =>
            setFilter({
              ...filter,
              page: 0,
              status:
                value === "all"
                  ? undefined
                  : (value as ModerationFilter["status"]),
            })
          }
        />
        <ReportFilter
          label="Объект жалобы"
          value={filter.targetType ?? "all"}
          values={reportTargetLabels}
          onChange={(value) =>
            setFilter({
              ...filter,
              page: 0,
              targetType:
                value === "all"
                  ? undefined
                  : (value as ModerationFilter["targetType"]),
            })
          }
        />
      </div>
      {reports.isPending ? (
        <div
          role="status"
          aria-label="Загружаем жалобы"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((id) => (
            <Skeleton key={id} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : reports.isError ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert
            message={getErrorMessage(
              reports.error,
              "Не удалось загрузить очередь.",
            )}
          />
          <Button variant="outline" onClick={() => void reports.refetch()}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : reports.data.content.length ? (
        <ul className="flex flex-col gap-3">
          {reports.data.content.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                className="flex w-full min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 text-left outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/40 sm:p-5"
                onClick={(event) => {
                  opener.current = event.currentTarget
                  setReportId(report.id)
                }}
              >
                <span className="flex w-full flex-wrap justify-between gap-2">
                  <span className="font-bold">
                    {reportTargetLabels[report.targetType] ?? report.targetType}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {reportStatusLabels[report.status] ?? report.status}
                  </span>
                </span>
                <span className="line-clamp-3 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                  {report.message}
                </span>
                <time
                  dateTime={report.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(report.createdAt).toLocaleString("ru")}
                </time>
                <span className="text-sm font-semibold text-primary">
                  Рассмотреть жалобу →
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="Жалоб с такими условиями нет"
          description="Выберите другой статус или тип обращения."
        />
      )}
      <ListPagination
        label="Страницы жалоб"
        page={filter.page}
        totalPages={reports.data?.totalPages ?? 0}
        busy={reports.isFetching}
        onPageChange={(page) => setFilter({ ...filter, page })}
      />
      {reportId && (
        <ReportDetails
          key={reportId}
          id={reportId}
          onClose={() => setReportId(null)}
          onReturnFocus={() => opener.current?.focus()}
        />
      )}
    </section>
  )
}

function ReportFilter({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: Record<string, string>
  onChange: (value: string) => void
}) {
  const id = label === "Статус жалобы" ? "report-status" : "report-target"
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Все</SelectItem>
            {Object.entries(values).map(([code, name]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
