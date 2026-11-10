import type { BadgeCategory, BadgeResponse } from "@/types"

export const badgeCategories: Record<
  BadgeCategory,
  { label: string; artwork: string }
> = {
  AUTHOR: { label: "Автор объявлений", artwork: "author" },
  HELPER: { label: "Помощник", artwork: "helper" },
  ADOPTION: { label: "Усыновление", artwork: "adoption" },
  TRUST: { label: "Доверие", artwork: "trust" },
  COMMUNICATION: { label: "Общение", artwork: "communication" },
}

const artworkByIcon = new Map([
  ["award", "award"],
  ["heart-handshake", "helper"],
  ["house", "adoption"],
  ["home", "adoption"],
  ["medal", "award"],
  ["message-circle", "communication"],
  ["paw-print", "author"],
  ["shield", "trust"],
  ["star", "award"],
  ["trophy", "award"],
])

// The backend owns the catalogue. These are illustrations for its starter codes.
const artworkByCode = new Map([
  ["FIRST_CASE", "author"],
  ["CARING_AUTHOR", "caring-author"],
  ["HOME_FOUND", "home-found"],
  ["READY_TO_HELP", "helper"],
  ["HELPED_IN_DEED", "helped-in-deed"],
  ["RELIABLE_HELPER", "reliable-helper"],
  ["VOLUNTEER", "volunteer"],
  ["WANT_HOME", "adoption"],
  ["STAY_IN_TOUCH", "stay-in-touch"],
  ["SAFE_LOGIN", "trust"],
  ["RESPONSIVE", "communication"],
])

export function badgeArtworkPath(
  badge?: Pick<BadgeResponse, "code" | "icon" | "category">,
) {
  const artwork = badge
    ? ((badge.icon ? artworkByIcon.get(badge.icon) : undefined) ??
      artworkByCode.get(badge.code) ??
      badgeCategories[badge.category]?.artwork)
    : undefined
  return `/badges/${artwork ?? "award"}.svg`
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
