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
import {
  FormAlert,
  IconCircle,
  LoadingButton,
  SectionCard,
} from "@/components/common"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Skeleton,
  Switch,
} from "@/components/ui"
import type {
  CurrentUser,
  NotificationChannelSetting,
  NotificationSetting,
} from "@/types"

const DEFAULT_QUIET_FROM = "22:00"
const DEFAULT_QUIET_TO = "08:00"

/** Settings of one event type, in API order. */
function groupByEvent(settings: readonly NotificationSetting[]) {
  const groups = new Map<string, NotificationSetting[]>()
  for (const setting of settings)
    groups.set(setting.eventType, [
      ...(groups.get(setting.eventType) ?? []),
      setting,
    ])
  return [...groups.values()]
}

export function NotificationsCard({ user }: { user: CurrentUser }) {
  const settings = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => accountApi.getNotifications(signal),
  })
  const update = useUpdateNotification()
  const channels = useNotificationChannels()
  const updateChannel = useUpdateNotificationChannel()
  const channelOf = (channel: string) =>
    channels.data?.find((item) => item.channel === channel)
  const [error, setError] = useState("")
  const onError = (mutationError: Error) =>
    setError(getErrorMessage(mutationError, "Не удалось сохранить настройку."))
  const saveChannel = (setting: NotificationChannelSetting) => {
    setError("")
    // The PUT replaces the setting, so quiet hours always travel along.
    updateChannel.mutate(setting, { onError })
  }

  return (
    <SectionCard
      icon={Bell}
      title="Уведомления"
      description="Выберите, где и о чём хотите получать новости."
      fullWidthBody
    >
      <section
        aria-labelledby="notification-channels"
        className="flex flex-col gap-3"
      >
        <h3 id="notification-channels" className="font-bold">
          Каналы
        </h3>
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
              <div key={setting.channel}>
                <div className="flex min-h-16 items-center gap-3 py-3">
                  <IconCircle
                    icon={
                      setting.channel === "EMAIL" ? Mail : MessageSquareText
                    }
                    size="sm"
                  />
                  <label
                    htmlFor={`channel-${setting.channel}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm font-semibold"
                  >
                    {setting.title}
                  </label>
                  <Switch
                    id={`channel-${setting.channel}`}
                    checked={setting.enabled}
                    disabled={updateChannel.isPending}
                    onCheckedChange={(enabled) =>
                      saveChannel({ ...setting, enabled })
                    }
                  />
                </div>
                {setting.channel === "EMAIL" && (
                  <QuietHours
                    // Restart the draft whenever the saved hours change.
                    key={`${setting.quietFrom}-${setting.quietTo}`}
                    setting={setting}
                    busy={updateChannel.isPending}
                    onSave={saveChannel}
                  />
                )}
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
      </section>
      <section
        aria-labelledby="notification-events"
        className="flex flex-col gap-3"
      >
        <h3 id="notification-events" className="font-bold">
          Что присылать
        </h3>
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
            {groupByEvent(settings.data).map((group) => (
              <li key={group[0].eventType} className="flex flex-col gap-2 py-3">
                <p className="text-sm font-semibold [overflow-wrap:anywhere]">
                  {group[0].title}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {group.map((setting) => {
                    const id = `notification-${setting.eventType}-${setting.channel}`
                    const channel = channelOf(setting.channel)
                    return (
                      <label
                        key={id}
                        htmlFor={id}
                        className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Switch
                          id={id}
                          checked={setting.enabled}
                          disabled={
                            update.isPending || channel?.enabled === false
                          }
                          onCheckedChange={(enabled) => {
                            setError("")
                            update.mutate({ ...setting, enabled }, { onError })
                          }}
                        />
                        {channel?.title ?? setting.channel}
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Сейчас нет уведомлений, которые можно настроить.
          </p>
        )}
      </section>
      <FormAlert message={error} />
      <p className="text-xs text-muted-foreground">
        Уведомления по объявлениям настраиваются на странице объявления. Коды
        подтверждения и восстановления пароля приходят всегда.
      </p>
    </SectionCard>
  )
}

/** EMAIL quiet hours, Minsk time. They may wrap past midnight (22:00 → 08:00). */
function QuietHours({
  setting,
  busy,
  onSave,
}: {
  setting: NotificationChannelSetting
  busy: boolean
  onSave: (setting: NotificationChannelSetting) => void
}) {
  const saved = !!(setting.quietFrom && setting.quietTo)
  const [enabled, setEnabled] = useState(saved)
  const [from, setFrom] = useState(setting.quietFrom ?? DEFAULT_QUIET_FROM)
  const [to, setTo] = useState(setting.quietTo ?? DEFAULT_QUIET_TO)
  const dirty =
    enabled !== saved ||
    (enabled && (from !== setting.quietFrom || to !== setting.quietTo))
  const invalid = !enabled
    ? ""
    : !from || !to
      ? "Укажите начало и конец тихих часов."
      : from === to
        ? "Начало и конец тихих часов не должны совпадать."
        : ""

  return (
    <Accordion type="single" collapsible className="pb-1">
      <AccordionItem value="quiet-hours">
        <AccordionTrigger className="py-2 text-sm font-medium">
          <span>
            Тихие часы
            <span className="ml-2 font-normal text-muted-foreground">
              {saved ? `${setting.quietFrom}–${setting.quietTo}` : "выключены"}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <label
            htmlFor="quiet-hours-enabled"
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <Switch
              id="quiet-hours-enabled"
              checked={enabled}
              disabled={busy}
              onCheckedChange={setEnabled}
            />
            Не присылать письма в это время
          </label>
          {enabled && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quiet-from" className="text-sm font-medium">
                  С
                </label>
                <Input
                  id="quiet-from"
                  type="time"
                  value={from}
                  disabled={busy}
                  onChange={(event) => setFrom(event.target.value)}
                  aria-invalid={!!invalid}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quiet-to" className="text-sm font-medium">
                  До
                </label>
                <Input
                  id="quiet-to"
                  type="time"
                  value={to}
                  disabled={busy}
                  onChange={(event) => setTo(event.target.value)}
                  aria-invalid={!!invalid}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Время по Минску. Письма в это время придут после окончания тихих
            часов. Коды подтверждения и сброс пароля приходят всегда.
          </p>
          <FormAlert message={invalid} />
          {dirty && (
            <LoadingButton
              type="button"
              className="h-11 w-full sm:h-10 sm:w-fit"
              loading={busy}
              loadingText="Сохраняем…"
              disabled={!!invalid}
              onClick={() =>
                onSave({
                  ...setting,
                  quietFrom: enabled ? from : null,
                  quietTo: enabled ? to : null,
                })
              }
            >
              Сохранить тихие часы
            </LoadingButton>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
