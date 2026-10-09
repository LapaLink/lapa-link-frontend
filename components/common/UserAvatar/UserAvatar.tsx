"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui"
import type { CurrentUser } from "@/types"
import { normalizeRemoteImageUrl } from "@/lib/images"

type UserAvatarProps = {
  user: Pick<CurrentUser, "displayName" | "avatarUrl">
  size?: "default" | "profile"
}

export function UserAvatar({ user, size = "default" }: UserAvatarProps) {
  const initials =
    user.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toLocaleUpperCase("ru") || "?"
  return (
    <Avatar size={size}>
      <AvatarImage
        src={normalizeRemoteImageUrl(user.avatarUrl) || undefined}
        alt={`Фото ${user.displayName}`}
      />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
