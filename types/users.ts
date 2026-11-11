import type { BadgeResponse } from "./badges"
import type { HelpOffer } from "./account"

/** Counters of the public profile. */
export type PublicProfileStats = {
  openCases: number
  closedCases: number
  /** Closed cases where a permanent home was found. */
  casesClosedHomeFound: number
  helpApplications: number
  assignmentsCompleted: number
  adoptionRequests: number
  conversationsAccepted: number
  activeHelpOffers: number
}

/** GET /users/{userId}; contacts, exact location and account checks are not included. */
export type PublicProfile = {
  id: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  cityCode: string | null
  /** In the current user's language. */
  cityName: string | null
  registeredAt: string
  stats: PublicProfileStats
  /** Newest first. */
  badges: BadgeResponse[]
  /** Active offers only. */
  helpOffers: HelpOffer[]
}
