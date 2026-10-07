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

import type { MyCaseListItem } from "@/types"

export function MyCaseCard({
  item,
  city,
}: {
  item: MyCaseListItem
  city: string
}) {
  return (
    <Card className="relative min-w-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <CasePhoto src={item.photoUrl} alt={item.title} />
      <CardHeader className="h-32">
        <CardDescription>
          {item.status === "OPEN" ? "Активно" : "Закрыто"}
        </CardDescription>
        <CardTitle className="line-clamp-2 h-11 [overflow-wrap:anywhere]">
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
            <span className="min-h-10">Открытых потребностей</span>
            <strong>{item.openNeedsCount}</strong>
          </p>
          <p className="flex flex-col gap-1">
            <MessageCircle className="size-5 text-primary" aria-hidden />
            <span className="min-h-10">Откликов</span>
            <strong>{item.applicationsCount}</strong>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Создано:{" "}
          {new Intl.DateTimeFormat("ru-RU").format(new Date(item.createdAt))}
        </p>
      </CardContent>
      <CardFooter className="h-20 flex flex-col justify-center gap-2 sm:flex-row">
        {item.status === "OPEN" && (
          <Button asChild variant="outline" className="relative z-10 w-full">
            <Link href={ROUTES.EDIT_CASE(item.id)}>Редактировать</Link>
          </Button>
        )}
        {item.status === "CLOSED" && <span className="text-sm text-muted-foreground">Помощь завершена</span>}
      </CardFooter>
    </Card>
  )
}
