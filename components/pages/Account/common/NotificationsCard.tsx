"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { accountApi, getErrorMessage } from "@/api"
import {
  useUpdateNotification,
  useNotificationChannels,
  useUpdateNotificationChannel,
} from "@/hooks"
import { queryKeys } from "@/lib/queryKeys"
import { Bell, Mail, MessageSquareText } from "lucide-react"
import { FormAlert, IconCircle, SectionCard } from "@/components/common"
import { Button, Skeleton, Switch } from "@/components/ui"
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
  const channels = useNotificationChannels()
  const updateChannel = useUpdateNotificationChannel()
  const emailEnabled =
    channels.data?.find((item) => item.channel === "EMAIL")?.enabled ?? false
  const [error, setError] = useState("")

  return (
    <SectionCard
      icon={Bell}
      title="Уведомления"
      description="Выберите, где хотите получать новости и отклики."
      fullWidthBody
    >
      {channels.isPending ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : channels.isError ? (
        <div className="space-y-3">
          <FormAlert
            message={getErrorMessage(
              channels.error,
              "Не удалось загрузить настройки уведомлений.",
            )}
          />
          <Button variant="outline" onClick={() => void channels.refetch()}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-2xl border bg-background/60 px-3 sm:px-4">
          {channels.data?.map((setting) => (
            <div
              key={setting.channel}
              className="flex min-h-16 items-center gap-3 py-3"
            >
              <IconCircle
                icon={setting.channel === "EMAIL" ? Mail : MessageSquareText}
                size="sm"
              />
              <label
                htmlFor={`channel-${setting.channel}`}
                className="min-w-0 flex-1 cursor-pointer text-sm font-semibold"
              >
                {setting.channel === "EMAIL"
                  ? "На электронную почту"
                  : "В приложении"}
              </label>
              <Switch
                id={`channel-${setting.channel}`}
                checked={setting.enabled}
                disabled={updateChannel.isPending}
                onCheckedChange={(enabled) => {
                  setError("")
                  updateChannel.mutate(
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
            </div>
          ))}
        </div>
      )}
      {user.emailVerifiedAt === null && (
        <p
          role="status"
          className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary"
        >
          Ваш email не подтверждён — письма не будут приходить, пока вы его не
          подтвердите.
        </p>
      )}
      {settings.isPending ? (
        <div
          role="status"
          aria-label="Загружаем уведомления"
          className="flex flex-col gap-3"
        >
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
        <ul className="divide-y rounded-2xl border bg-background/60 px-3 sm:px-4">
          {settings.data.map((setting) => {
            const id = `notification-${setting.eventType}-${setting.channel}`
            return (
              <li
                key={id}
                className="flex min-h-16 items-center gap-3 py-3"
              >
                <IconCircle
                  icon={setting.channel === "EMAIL" ? Mail : Bell}
                  size="sm"
                />
                <label
                  htmlFor={id}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
                >
                  <span className="text-sm font-semibold [overflow-wrap:anywhere]">
                    {eventLabels[setting.eventType] ?? setting.eventType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {channelLabels[setting.channel] ?? setting.channel}
                  </span>
                </label>
                <Switch
                  id={id}
                  checked={setting.enabled}
                  disabled={
                    update.isPending ||
                    (setting.channel === "EMAIL" && !emailEnabled)
                  }
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
        Уведомления по объявлениям настраиваются на странице объявления. Коды
        подтверждения и восстановления пароля приходят всегда.
      </p>
    </SectionCard>
  )
}
