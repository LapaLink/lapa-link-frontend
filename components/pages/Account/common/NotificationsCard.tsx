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
import {
  Bell,
  ChevronDown,
  Mail,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react"
import { FormAlert, LoadingButton, SectionCard } from "@/components/common"
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

// Short explanations under the channel names.
const channelHints: Record<string, string> = {
  EMAIL: "Письма на вашу почту. Ночью можно включить тихие часы.",
  IN_APP: "Колокольчик на сайте и всплывающие подсказки.",
}
const channelIcons: Record<string, LucideIcon> = {
  EMAIL: Mail,
  IN_APP: MessageSquareText,
}

export function NotificationsCard({ user }: { user: CurrentUser }) {
  return (
    <SectionCard
      icon={Bell}
      title="Уведомления"
      description="Выберите, где и о чём хотите получать новости."
      fullWidthBody
    >
      <NotificationSettings user={user} collapsibleEvents />
    </SectionCard>
  )
}

/**
 * Channels with EMAIL quiet hours, then a table of events by channel. Every
 * change saves at once. `collapsibleEvents` folds the table (profile overview).
 */
export function NotificationSettings({
  user,
  collapsibleEvents = false,
}: {
  user: CurrentUser
  collapsibleEvents?: boolean
}) {
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
  // Table columns: channels in their own order, then any only events know.
  const columns = [
    ...new Set([
      ...(channels.data ?? []).map((item) => item.channel),
      ...(settings.data ?? []).map((item) => item.channel),
    ]),
  ]

  const events = settings.isPending ? (
    <div
      role="status"
      aria-label="Загружаем уведомления"
      className="flex flex-col gap-3 p-4"
    >
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-2/3" />
    </div>
  ) : settings.isError ? (
    <div className="flex flex-col items-start gap-3 p-4">
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
    <div role="table" aria-labelledby="notification-events" className="min-w-0">
      <div
        role="row"
        className="flex items-center gap-2 border-b border-foreground/[0.06] px-4 py-2.5 text-xs font-semibold text-foreground/70"
      >
        <span role="columnheader" className="min-w-0 flex-1">
          Событие
        </span>
        {columns.map((channel) => {
          const Icon = channelIcons[channel] ?? Bell
          return (
            <span
              key={channel}
              role="columnheader"
              className="flex w-16 shrink-0 flex-col items-center gap-1 text-center sm:w-24"
            >
              <Icon aria-hidden className="size-4" />
              <span
                id={`notification-column-${channel}`}
                className="sr-only sm:not-sr-only"
              >
                {channelOf(channel)?.title ?? channel}
              </span>
            </span>
          )
        })}
      </div>
      {groupByEvent(settings.data).map((group) => (
        <div
          key={group[0].eventType}
          role="row"
          className="flex min-h-14 items-center gap-2 border-b border-foreground/[0.06] px-4 py-2 last:border-b-0"
        >
          <span
            id={`notification-event-${group[0].eventType}`}
            role="rowheader"
            className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]"
          >
            {group[0].title}
          </span>
          {columns.map((channel) => {
            const setting = group.find((item) => item.channel === channel)
            const id = setting && `notification-${setting.eventType}-${channel}`
            return (
              <span
                key={channel}
                role="cell"
                className="flex w-16 shrink-0 justify-center sm:w-24"
              >
                {setting ? (
                  <Switch
                    id={id}
                    aria-labelledby={`notification-event-${setting.eventType} notification-column-${channel}`}
                    checked={setting.enabled}
                    disabled={
                      update.isPending || channelOf(channel)?.enabled === false
                    }
                    onCheckedChange={(enabled) => {
                      setError("")
                      update.mutate({ ...setting, enabled }, { onError })
                    }}
                  />
                ) : (
                  <span aria-label="Недоступно" className="text-foreground/30">
                    —
                  </span>
                )}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  ) : (
    <p className="p-4 text-sm text-muted-foreground">
      Сейчас нет уведомлений, которые можно настроить.
    </p>
  )

  return (
    <>
      <section
        aria-labelledby="notification-channels"
        className="flex flex-col gap-1"
      >
        <h3
          id="notification-channels"
          className="text-xs font-bold tracking-wide text-foreground/60 uppercase"
        >
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
          <div className="divide-y divide-foreground/[0.06]">
            {channels.data?.map((setting) => {
              const Icon = channelIcons[setting.channel] ?? Bell
              return (
                <div key={setting.channel} className="py-4">
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <label
                        htmlFor={`channel-${setting.channel}`}
                        className="cursor-pointer font-semibold"
                      >
                        {setting.title}
                      </label>
                      {channelHints[setting.channel] && (
                        <p className="text-sm text-foreground/70">
                          {channelHints[setting.channel]}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={`channel-${setting.channel}`}
                      checked={setting.enabled}
                      disabled={updateChannel.isPending}
                      className="mt-1"
                      onCheckedChange={(enabled) =>
                        saveChannel({ ...setting, enabled })
                      }
                    />
                  </div>
                  {setting.channel === "EMAIL" && (
                    <div className="pl-14">
                      <QuietHours
                        // Restart the draft whenever the saved hours change.
                        key={`${setting.quietFrom}-${setting.quietTo}`}
                        setting={setting}
                        busy={updateChannel.isPending}
                        onSave={saveChannel}
                      />
                    </div>
                  )}
                </div>
              )
            })}
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
      {collapsibleEvents ? (
        <details className="group/events overflow-hidden rounded-2xl border border-foreground/[0.07]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-foreground/60 transition-transform group-open/events:rotate-180"
            />
            <span className="flex min-w-0 flex-col">
              <span id="notification-events" className="font-semibold">
                Что присылать
              </span>
              <span className="text-xs text-foreground/70">
                Приветствие, новые потребности рядом и другие события
              </span>
            </span>
          </summary>
          <div className="border-t border-foreground/[0.06]">{events}</div>
        </details>
      ) : (
        <section
          aria-labelledby="notification-events"
          className="overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card shadow-card"
        >
          <h3
            id="notification-events"
            className="border-b border-foreground/[0.06] px-4 py-4 text-lg font-bold"
          >
            Что присылать
          </h3>
          {events}
        </section>
      )}
      <FormAlert message={error} />
      <p className="text-xs text-muted-foreground">
        Уведомления по объявлениям настраиваются на странице объявления. Коды
        подтверждения и восстановления пароля приходят всегда.
      </p>
    </>
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
