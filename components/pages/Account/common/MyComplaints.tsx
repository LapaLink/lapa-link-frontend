"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronRight,
  Flag,
  MessageCircle,
  PawPrint,
  UserRound,
} from "lucide-react"
import { complaintsApi, getErrorMessage } from "@/api"
import { ROUTES } from "@/lib/constants"
import type { Complaint, ComplaintStatus, ComplaintTargetType } from "@/types"
import {
  EmptyState,
  FormAlert,
  ListPagination,
  StatusBadge,
} from "@/components/common"
import { Button, Skeleton } from "@/components/ui"

const PAGE_SIZE = 20

const targets: Record<
  ComplaintTargetType,
  { label: string; icon: typeof Flag; href?: (id: string) => string }
> = {
  CASE: { label: "Объявление", icon: PawPrint, href: ROUTES.CASE_DETAILS },
  USER: { label: "Пользователь", icon: UserRound },
  // A deleted conversation opens as "not found", which is fine here.
  CONVERSATION: { label: "Чат", icon: MessageCircle, href: ROUTES.CHAT },
}

const statuses: Record<
  ComplaintStatus,
  { label: string; tone: "primary" | "muted" | "success" | "danger" }
> = {
  NEW: { label: "Новая", tone: "primary" },
  IN_PROGRESS: { label: "На рассмотрении", tone: "primary" },
  REJECTED: { label: "Отклонена", tone: "muted" },
  RESOLVED: { label: "Решена", tone: "success" },
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** The user's complaints about cases, users and chats with their status. */
export function MyComplaints() {
  const [page, setPage] = useState(0)
  const complaints = useQuery({
    queryKey: ["account", "complaints", page],
    queryFn: ({ signal }) => complaintsApi.my(page, PAGE_SIZE, signal),
  })

  if (complaints.isPending)
    return (
      <div
        role="status"
        aria-label="Загружаем жалобы"
        className="flex flex-col gap-3"
      >
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  if (complaints.isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <FormAlert
          message={getErrorMessage(
            complaints.error,
            "Не удалось загрузить жалобы.",
          )}
        />
        <Button variant="outline" onClick={() => void complaints.refetch()}>
          Попробовать ещё раз
        </Button>
      </div>
    )
  if (!complaints.data.content.length)
    return (
      <EmptyState
        icon={Flag}
        title="Жалоб пока нет"
        description="Пожаловаться можно на объявление или на переписку в чате — из их меню."
      />
    )
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {complaints.data.content.map((complaint) => (
          <ComplaintItem key={complaint.id} complaint={complaint} />
        ))}
      </ul>
      <ListPagination
        label="Страницы жалоб"
        page={page}
        totalPages={complaints.data.totalPages}
        busy={complaints.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}

function ComplaintItem({ complaint }: { complaint: Complaint }) {
  const target = targets[complaint.targetType] ?? targets.CASE
  const status = statuses[complaint.status] ?? statuses.NEW
  const href = target.href?.(complaint.targetId)
  const Icon = target.icon
  const body = (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{target.label}</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </span>
        <span className="line-clamp-2 text-sm whitespace-pre-wrap text-foreground/80 [overflow-wrap:anywhere]">
          {complaint.message}
        </span>
        <time
          dateTime={complaint.createdAt}
          className="text-xs text-foreground/60"
        >
          {dateFormat.format(new Date(complaint.createdAt))}
        </time>
      </span>
    </>
  )
  const className =
    "flex items-start gap-3 rounded-2xl border border-foreground/[0.07] bg-card p-4 shadow-card"
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={`${className} group outline-none transition-colors hover:border-primary/25 focus-visible:ring-3 focus-visible:ring-ring/40`}
        >
          {body}
          <ChevronRight
            aria-hidden
            className="mt-2.5 size-4 shrink-0 text-foreground/40 group-hover:text-primary"
          />
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}
