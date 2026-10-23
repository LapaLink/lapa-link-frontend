import { CasePhoto, IconCircle, StatusBadge } from "@/components/common"
import Link from "next/link"
import { HeartHandshake, MapPin, MessageCircle } from "lucide-react"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui"
import { caseStatusAppearance } from "../../Cases/statusLabels"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"

import type { CaseStatus, MyCaseListItem } from "@/types"

const statusLabels: Record<CaseStatus, string> = {
  PENDING_REVIEW: "На проверке",
  OPEN: "Активно",
  REJECTED: "Отклонено",
  CLOSED: "Закрыто",
}

export function MyCaseCard({
  item,
  city,
}: {
  item: MyCaseListItem
  city: string
}) {
  const isOpen = item.status === "OPEN"
  const editable = isOpen || item.status === "PENDING_REVIEW"
  const hasApplications = item.applicationsCount > 0
  return (
    <Card className="relative min-w-0 overflow-hidden pt-0 transition-colors hover:border-primary/30">
      <div className="relative">
        <CasePhoto src={item.photoUrl} alt={item.title} />
        <StatusBadge
          tone={caseStatusAppearance[item.status].tone}
          icon={caseStatusAppearance[item.status].icon}
          className="absolute left-3 top-3 shadow-sm ring-1 ring-card"
        >
          {statusLabels[item.status]}
        </StatusBadge>
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2 text-lg font-bold [overflow-wrap:anywhere]">
          <Link
            href={ROUTES.CASE_DETAILS(item.id)}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/30"
          >
            {item.title}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {item.animalType === "CAT" ? "Кошка" : "Собака"} · {city}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-background/60 p-3 text-sm">
          <p className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-2 text-lg">
              <IconCircle icon={HeartHandshake} size="sm" />
              <strong>{item.openNeedsCount}</strong>
            </span>
            <span className="text-xs text-muted-foreground">Ждут помощи</span>
          </p>
          <p className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-2 text-lg">
              <IconCircle icon={MessageCircle} size="sm" />
              <strong>{item.applicationsCount}</strong>
            </span>
            <span className="text-xs text-muted-foreground">
              Предложили помощь
            </span>
          </p>
        </div>
        {item.status === "PENDING_REVIEW" && (
          <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
            Объявление проверяет модератор. После одобрения оно появится в
            общем списке.
          </p>
        )}
        {isOpen && (
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              hasApplications
                ? "bg-primary-soft font-medium text-primary"
                : "text-muted-foreground",
            )}
          >
            {hasApplications
              ? "Откройте объявление, чтобы посмотреть предложения и выбрать помощника."
              : "Пока никто не предложил помощь. Мы покажем здесь, когда это произойдёт."}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Создано:{" "}
          {new Intl.DateTimeFormat("ru-RU").format(new Date(item.createdAt))}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {editable ? (
          <>
            <Button asChild className="relative z-10 h-11 w-full sm:h-10">
              <Link href={ROUTES.CASE_DETAILS(item.id)}>
                {hasApplications ? "Посмотреть предложения" : "Открыть"}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="relative z-10 h-11 w-full sm:h-10"
            >
              <Link href={ROUTES.EDIT_CASE(item.id)}>Редактировать</Link>
            </Button>
          </>
        ) : item.status === "REJECTED" ? (
          <span className="text-sm text-muted-foreground">
            Объявление отклонено модератором — причина указана внутри.
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Объявление закрыто — спасибо, что помогли!
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
