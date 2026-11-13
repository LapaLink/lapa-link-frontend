"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { casesApi } from "@/api"
import { useCities, useDictionaryLocale, useNeedTypes } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import { NavigationLink as Link } from "@/components/providers"
import { Button, Skeleton } from "@/components/ui"
import { CaseFeedCard } from "../Cases/CaseFeedCard"

const URGENT_ON_HOME = 3

/**
 * «Срочно нужна помощь» under the hero: the animals come first, so the home
 * page shows real urgent cases with photos. Nothing is shown when there are
 * none or the feed cannot be loaded.
 */
export function HomeUrgent() {
  const locale = useDictionaryLocale()
  const cities = useCities()
  const needTypes = useNeedTypes()
  const urgent = useQuery({
    queryKey: ["cases", "list", "home-urgent"],
    queryFn: ({ signal }) =>
      casesApi.list(
        { priority: "HIGH", orderBy: "DEADLINE", size: URGENT_ON_HOME },
        signal,
      ),
  })
  const items = (urgent.data?.content ?? []).filter((item) => item.topNeed)
  if (urgent.isError || (!urgent.isPending && !items.length)) return null
  return (
    <section aria-labelledby="home-urgent" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="home-urgent"
          className="text-2xl font-extrabold tracking-tight sm:text-3xl"
        >
          Срочно нужна помощь
        </h2>
        <Button asChild variant="ghost">
          <Link href={ROUTES.CASES}>
            Все объявления
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {urgent.isPending
          ? Array.from({ length: URGENT_ON_HOME }, (_, key) => (
              <Skeleton key={key} className="h-96 rounded-2xl" />
            ))
          : items.map((item) => (
              <CaseFeedCard
                key={item.id}
                item={item}
                cityName={getCityName(cities.data, item.cityCode, locale)}
                needTypeName={(code) =>
                  getDictionaryName(needTypes.data, code, locale)
                }
              />
            ))}
      </div>
    </section>
  )
}
