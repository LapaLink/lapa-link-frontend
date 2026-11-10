"use client"

import { useQuery } from "@tanstack/react-query"
import { Award } from "lucide-react"
import { cn } from "cn"
import { accountApi, getErrorMessage } from "@/api"
import { BadgeArtwork, EmptyState, FormAlert } from "@/components/common"
import { Button, Card, CardContent, Skeleton } from "@/components/ui"
import { badgeCategories, groupBadges } from "@/lib/badges"
import { queryKeys } from "@/lib/queryKeys"

export function MyBadges({ locale }: { locale?: string | null }) {
  const badges = useQuery({
    queryKey: queryKeys.myBadges,
    queryFn: ({ signal }) => accountApi.getBadges(signal),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (badges.isPending)
    return (
      <div
        role="status"
        aria-label="Загружаем значки"
        className="grid gap-3 sm:grid-cols-2"
      >
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  if (badges.isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <FormAlert
          message={getErrorMessage(
            badges.error,
            "Не удалось загрузить значки.",
          )}
        />
        <Button
          variant="outline"
          onClick={() => void badges.refetch()}
          disabled={badges.isFetching}
        >
          Повторить
        </Button>
      </div>
    )
  const earned = badges.data.filter((badge) => badge.earned).length
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-sm font-bold text-primary" aria-live="polite">
        Получено {earned} из {badges.data.length}
      </p>
      {badges.data.length === 0 && (
        <EmptyState
          icon={Award}
          title="Значков пока нет"
          description="Здесь появятся достижения, доступные в приложении."
        />
      )}
      {[...groupBadges(badges.data)].map(([category, group]) => (
        <section
          key={category}
          className="flex min-w-0 flex-col gap-3"
          aria-label={badgeCategories[category]?.label ?? "Другие значки"}
        >
          <h2 className="font-bold">
            {badgeCategories[category]?.label ?? "Другие значки"}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.map((badge) => (
              <li key={badge.code} className="min-w-0">
                <Card
                  className={cn(
                    "h-full",
                    badge.earned && "border-primary/30 bg-primary-soft/40",
                  )}
                >
                  <CardContent className="flex min-w-0 items-start gap-3">
                    <BadgeArtwork badge={badge} dimmed={!badge.earned} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
                      <h3 className="font-bold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {badge.description}
                      </p>
                      {badge.earned ? (
                        <p className="mt-1 text-xs font-semibold text-primary">
                          Получено
                          {badge.awardedAt && (
                            <>
                              {" "}
                              ·{" "}
                              <time dateTime={badge.awardedAt}>
                                {new Date(badge.awardedAt).toLocaleDateString(
                                  locale === "be" ? "be-BY" : "ru-RU",
                                )}
                              </time>
                            </>
                          )}
                        </p>
                      ) : (
                        <>
                          <progress
                            aria-label={`Прогресс: ${badge.name}`}
                            value={badge.progress}
                            max={badge.threshold}
                            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted accent-primary"
                          />
                          <p className="text-xs text-muted-foreground">
                            {badge.progress} из {badge.threshold}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
