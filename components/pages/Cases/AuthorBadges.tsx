"use client"

import type { ReactNode } from "react"
import { badgeIcon } from "@/lib/badges"
import type { BadgeResponse } from "@/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui"

const VISIBLE_BADGES = 3

export function AuthorBadges({
  badges,
}: {
  badges?: readonly BadgeResponse[]
}) {
  if (!badges?.length) return null
  const latest = [...badges].sort(
    (a, b) => Date.parse(b.awardedAt) - Date.parse(a.awardedAt),
  )
  const remaining = latest.slice(VISIBLE_BADGES)
  return (
    <ul
      aria-label="Значки автора"
      className="flex flex-wrap items-center gap-1"
    >
      {latest.slice(0, VISIBLE_BADGES).map((badge) => {
        const Icon = badgeIcon(badge.icon, badge.category)
        return (
          <li key={badge.code}>
            <BadgeDetails
              title={badge.name}
              description={badge.description}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full text-primary"
                  aria-label={badge.name}
                  title={badge.name}
                >
                  <Icon aria-hidden />
                </Button>
              }
            />
          </li>
        )
      })}
      {remaining.length > 0 && (
        <li>
          <BadgeDetails
            title="Другие значки автора"
            description="Полученные достижения"
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-full"
                aria-label={`Другие значки автора: ${remaining.length}`}
              >
                +{remaining.length}
              </Button>
            }
          >
            <ul className="flex flex-col gap-3">
              {remaining.map((badge) => {
                const Icon = badgeIcon(badge.icon, badge.category)
                return (
                  <li
                    key={badge.code}
                    className="flex min-w-0 items-start gap-3"
                  >
                    <Icon
                      aria-hidden
                      className="mt-0.5 size-5 shrink-0 text-primary"
                    />
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                      <p className="font-semibold">{badge.name}</p>
                      <p className="text-muted-foreground">
                        {badge.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </BadgeDetails>
        </li>
      )}
    </ul>
  )
}

function BadgeDetails({
  title,
  description,
  trigger,
  children,
}: {
  title: string
  description: string
  trigger: ReactNode
  children?: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto [overflow-wrap:anywhere]">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
