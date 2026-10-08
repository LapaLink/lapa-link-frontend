"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { accountApi, getErrorMessage } from "@/api"
import { useUpdateNotification } from "@/hooks"
import { queryKeys } from "@/lib/queryKeys"
import { FormAlert } from "@/components/common"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
  Switch,
} from "@/components/ui"
import type { CurrentUser } from "@/types"

// Labels for known event types; unknown types fall back to their code.
const eventLabels: Record<string, string> = {
  WELCOME: "Приветственное письмо после регистрации",
}
const channelLabels: Record<string, string> = {
  EMAIL: "Email",
}

export function NotificationsCard({ user }: { user: CurrentUser }) {
  const settings = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => accountApi.getNotifications(signal),
  })
  const update = useUpdateNotification()
  const [error, setError] = useState("")

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Уведомления</h2>
        </CardTitle>
        <CardDescription>
          Выберите, какие письма вы хотите получать.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {user.emailVerifiedAt === null && (
          <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm text-primary">
            Ваш email не подтверждён — письма не будут приходить, пока вы его
            не подтвердите.
          </p>
        )}
        {settings.isPending ? (
          <div role="status" aria-label="Загружаем уведомления" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : settings.isError ? (
          <div className="flex flex-col items-start gap-3">
            <FormAlert
              message={getErrorMessage(
                settings.error,
                "Не удалось загрузить настройки уведомлений.",
              )}
            />
            <Button variant="outline" onClick={() => void settings.refetch()}>
              Попробовать ещё раз
            </Button>
          </div>
        ) : settings.data.length ? (
          <ul className="flex flex-col gap-4">
            {settings.data.map((setting) => {
              const id = `notification-${setting.eventType}-${setting.channel}`
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-4"
                >
                  <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium [overflow-wrap:anywhere]">
                      {eventLabels[setting.eventType] ?? setting.eventType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {channelLabels[setting.channel] ?? setting.channel}
                    </span>
                  </label>
                  <Switch
                    id={id}
                    checked={setting.enabled}
                    disabled={update.isPending}
                    onCheckedChange={(enabled) => {
                      setError("")
                      update.mutate(
                        { ...setting, enabled },
                        {
                          onError: (mutationError) =>
                            setError(
                              getErrorMessage(
                                mutationError,
                                "Не удалось сохранить настройку.",
                              ),
                            ),
                        },
                      )
                    }}
                  />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Сейчас нет уведомлений, которые можно настроить.
          </p>
        )}
        <FormAlert message={error} />
        <p className="text-xs text-muted-foreground">
          Уведомления по объявлениям настраиваются на странице объявления.
        </p>
      </CardContent>
    </Card>
  )
}
