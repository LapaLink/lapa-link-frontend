import { CasePhoto } from "@/components/common"
import Link from "next/link"
import { MapPin, MessageCircle, HeartHandshake } from "lucide-react"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"

import type { MyCaseListItem } from "@/types"

export function MyCaseCard({
  item,
  city,
}: {
  item: MyCaseListItem
  city: string
}) {
  const isOpen = item.status === "OPEN"
  const hasApplications = item.applicationsCount > 0
  return (
    <Card className="relative min-w-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <div className="relative">
        <CasePhoto src={item.photoUrl} alt={item.title} />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm",
            isOpen
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground",
          )}
        >
          {isOpen ? "Активно" : "Закрыто"}
        </span>
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2 [overflow-wrap:anywhere]">
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
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
          <p className="flex flex-col gap-1">
            <HeartHandshake className="size-5 text-primary" aria-hidden />
            <span className="text-muted-foreground">Ждут помощи</span>
            <strong>{item.openNeedsCount}</strong>
          </p>
          <p className="flex flex-col gap-1">
            <MessageCircle className="size-5 text-primary" aria-hidden />
            <span className="text-muted-foreground">Предложили помощь</span>
            <strong>{item.applicationsCount}</strong>
          </p>
        </div>
        {isOpen && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              hasApplications
                ? "bg-secondary font-medium text-primary"
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
        {isOpen ? (
          <>
            <Button asChild className="relative z-10 w-full">
              <Link href={ROUTES.CASE_DETAILS(item.id)}>
                {hasApplications ? "Посмотреть предложения" : "Открыть"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="relative z-10 w-full">
              <Link href={ROUTES.EDIT_CASE(item.id)}>Редактировать</Link>
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Объявление закрыто — спасибо, что помогли!
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
