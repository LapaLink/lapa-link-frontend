"use client"

import { MessagesSquare } from "lucide-react"
import { toast } from "sonner"
import { useChatPermission, useSetChatPermission } from "@/hooks"
import { chatErrorMessage } from "@/lib/chat"
import type { CurrentUser } from "@/types"
import { SectionCard } from "@/components/common"
import { Switch } from "@/components/ui"

/**
 * «Принимать личные сообщения»: the owner switch of the USER chat target (on
 * by default). Off: other users cannot send requests and existing personal
 * chats become read-only until it is turned on again.
 */
export function PersonalChatCard({ user }: { user: CurrentUser }) {
  const permission = useChatPermission("USER", user.id, true)
  const set = useSetChatPermission("USER", user.id)
  return (
    <SectionCard
      icon={MessagesSquare}
      title="Личные сообщения"
      description="Если выключить, другие пользователи не смогут писать вам из вашего профиля, а текущие личные чаты станут только для чтения."
      fullWidthBody
    >
      <label
        htmlFor="personal-chat"
        className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-medium"
      >
        Принимать личные сообщения
        <Switch
          id="personal-chat"
          checked={permission.data?.enabled ?? true}
          disabled={!permission.data || set.isPending}
          onCheckedChange={(enabled) =>
            set.mutate(enabled, {
              onError: (error) =>
                toast.error(
                  chatErrorMessage(error, "Не удалось сохранить настройку."),
                ),
            })
          }
        />
      </label>
    </SectionCard>
  )
}
