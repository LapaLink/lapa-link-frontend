"use client"

import { cn } from "cn"
import { Check } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { accountApi } from "@/api"
import { NavigationLink as Link } from "@/components/providers"
import {
  useCities,
  useDictionaryLocale,
  useNeedTypes,
  useNotificationChannels,
} from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import { queryKeys } from "@/lib/queryKeys"
import type { CurrentUser } from "@/types"
import { Button } from "@/components/ui"
import { ONBOARDING_STEPS } from "./steps"

/** Summary of what was filled in; skipped steps link back to themselves. */
export function DoneStep({
  user,
  skipped,
  onOpenStep,
}: {
  user: CurrentUser
  /** Zero-based indexes of skipped steps. */
  skipped: ReadonlySet<number>
  onOpenStep: (index: number) => void
}) {
  const locale = useDictionaryLocale()
  const cities = useCities()
  const needTypes = useNeedTypes()
  const channels = useNotificationChannels()
  const offers = useQuery({
    queryKey: queryKeys.helpOffers,
    queryFn: ({ signal }) => accountApi.getHelpOffers(signal),
  })
  const email = channels.data?.find((item) => item.channel === "EMAIL")

  const values = [
    [
      user.displayName,
      user.cityCode && getCityName(cities.data, user.cityCode, locale),
    ]
      .filter(Boolean)
      .join(" · "),
    [
      channels.data
        ?.filter((item) => item.enabled)
        .map((item) => item.title)
        .join(", ") || "Все каналы выключены",
      email?.enabled && email.quietFrom
        ? `тихие часы ${email.quietFrom}–${email.quietTo}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    offers.data?.length
      ? offers.data
          .map(
            (offer) =>
              `${getDictionaryName(needTypes.data, offer.type, locale)} до ${offer.radiusKm} км`,
          )
          .join(", ")
      : "Ничего не выбрано",
    user.homeLatitude != null
      ? "Домашняя точка задана"
      : "Без точки — подбираем по городу без учёта радиуса",
  ]

  return (
    <section
      aria-labelledby="onboarding-done"
      className="flex flex-col items-center gap-6 rounded-2xl border bg-card px-5 py-10 text-center sm:px-8"
    >
      <span
        aria-hidden
        className="flex size-18 items-center justify-center rounded-full bg-success text-success-foreground"
      >
        <Check className="size-9" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-2">
        <h1
          id="onboarding-done"
          className="text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere]"
        >
          Готово, {user.displayName}!
        </h1>
        <p className="text-muted-foreground">
          Пропущенное можно заполнить в любой момент в профиле.
        </p>
      </div>
      <ul className="w-full max-w-xl divide-y rounded-2xl border px-4 text-left">
        {ONBOARDING_STEPS.map((step, index) => {
          const isSkipped = skipped.has(index)
          return (
            <li
              key={step.label}
              className="flex min-h-16 items-center gap-3 py-2"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  isSkipped ? "bg-input" : "bg-success-foreground",
                )}
              />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="block text-sm font-bold">{step.label}</span>
                <span className="block text-sm text-muted-foreground">
                  {isSkipped ? "Пропущено" : values[index]}
                </span>
              </span>
              {isSkipped && (
                <Button
                  variant="ghost"
                  className="h-11 text-primary sm:h-10"
                  onClick={() => onOpenStep(index)}
                >
                  Заполнить
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex w-full flex-col justify-center gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link href={ROUTES.CASES}>Найти, кому помочь</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={ROUTES.ACCOUNT}>Открыть профиль</Link>
        </Button>
      </div>
    </section>
  )
}
