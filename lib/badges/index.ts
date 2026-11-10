import {
  Award,
  HeartHandshake,
  House,
  Medal,
  MessageCircle,
  PawPrint,
  Shield,
  Star,
  Trophy,
} from "lucide-react"
import type { BadgeCategory } from "@/types"

export const badgeCategories: Record<
  BadgeCategory,
  { label: string; icon: typeof Award }
> = {
  AUTHOR: { label: "Автор объявлений", icon: PawPrint },
  HELPER: { label: "Помощник", icon: HeartHandshake },
  ADOPTION: { label: "Усыновление", icon: House },
  TRUST: { label: "Доверие", icon: Shield },
  COMMUNICATION: { label: "Общение", icon: MessageCircle },
}

const icons = new Map([
  ["award", Award],
  ["heart-handshake", HeartHandshake],
  ["house", House],
  ["home", House],
  ["medal", Medal],
  ["message-circle", MessageCircle],
  ["paw-print", PawPrint],
  ["shield", Shield],
  ["star", Star],
  ["trophy", Trophy],
])

export function badgeIcon(icon: string | null, category: BadgeCategory) {
  return (
    (icon ? icons.get(icon) : undefined) ??
    badgeCategories[category]?.icon ??
    Award
  )
}

export function groupBadges<T extends { category: BadgeCategory }>(
  badges: readonly T[],
) {
  const groups = new Map<BadgeCategory, T[]>()
  for (const badge of badges) {
    const group = groups.get(badge.category)
    if (group) group.push(badge)
    else groups.set(badge.category, [badge])
  }
  return groups
}
