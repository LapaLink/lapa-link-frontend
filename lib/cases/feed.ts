import type {
  AnimalType,
  CaseFeedFilter,
  CaseFeedSort,
  CaseMapFilter,
  NeedPriority,
  NeedStatus,
} from "@/types"

export type FeedMode = "all" | "matching"
export type FeedPoint = { latitude: number; longitude: number }

/** Feed filters, mode and page as kept in the URL query string. */
export type FeedState = {
  mode: FeedMode
  animalType?: AnimalType
  cityCode?: string
  search: string
  /** Need type codes; a case matches if it has a need of any of them. */
  needTypes: string[]
  priority?: NeedPriority
  needStatus?: NeedStatus
  point?: FeedPoint
  radiusKm?: number
  orderBy: CaseFeedSort
  page: number
}

export const FEED_SEARCH_MAX = 200
export const FEED_DEFAULT_RADIUS_KM = 10
export const FEED_SORTS: readonly CaseFeedSort[] = [
  "NEWEST",
  "DISTANCE",
  "PRIORITY",
  "DEADLINE",
]
/** Largest map area per axis the backend accepts (else 400 INVALID_BOUNDS). */
export const MAP_MAX_SPAN = 2
const ANIMAL_TYPES: readonly AnimalType[] = ["CAT", "DOG"]
const PRIORITIES: readonly NeedPriority[] = ["LOW", "MEDIUM", "HIGH"]
const NEED_STATUSES: readonly NeedStatus[] = ["OPEN", "ASSIGNED", "CLOSED"]

const oneOf = <T extends string>(list: readonly T[], value: string | null) =>
  list.find((item) => item === value)

function coordinate(value: string | null, limit: number) {
  if (value === null || value.trim() === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= limit
    ? number
    : undefined
}

/** ~1 m is plenty for a feed point and keeps URLs short. */
const round = (value: number) => Math.round(value * 1e5) / 1e5

/**
 * Radius and DISTANCE order need a point (the backend answers 400
 * FEED_POINT_REQUIRED otherwise), so they are dropped without one.
 */
function normalize(state: FeedState): FeedState {
  if (state.point) return state
  return {
    ...state,
    radiusKm: undefined,
    orderBy: state.orderBy === "DISTANCE" ? "NEWEST" : state.orderBy,
  }
}

/**
 * Need type codes from `needType=A&needType=B` and/or `needType=A,B`:
 * trimmed, without empty values and repeats.
 */
function parseNeedTypes(values: readonly string[]) {
  const codes = values.flatMap((value) => value.split(","))
  return [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
}

/** Reads the feed state from the URL; invalid values are ignored, `title` maps to `search`. */
export function parseFeedState(params: {
  get(name: string): string | null
  getAll(name: string): string[]
}): FeedState {
  const latitude = coordinate(params.get("latitude"), 90)
  const longitude = coordinate(params.get("longitude"), 180)
  const radius = Number(params.get("radiusKm"))
  const page = Number(params.get("page"))
  return normalize({
    mode: params.get("mode") === "matching" ? "matching" : "all",
    animalType: oneOf(ANIMAL_TYPES, params.get("animalType")),
    cityCode: params.get("cityCode")?.trim() || undefined,
    search: (params.get("search") ?? params.get("title") ?? "")
      .trim()
      .slice(0, FEED_SEARCH_MAX),
    needTypes: parseNeedTypes(params.getAll("needType")),
    priority: oneOf(PRIORITIES, params.get("priority")),
    needStatus: oneOf(NEED_STATUSES, params.get("needStatus")),
    point:
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : undefined,
    radiusKm:
      Number.isInteger(radius) && radius >= 1 && radius <= 100
        ? radius
        : undefined,
    orderBy: oneOf(FEED_SORTS, params.get("orderBy")) ?? "NEWEST",
    page: Number.isInteger(page) && page > 0 ? page : 0,
  })
}

/** Query string for the state; defaults are left out and `title` is never written. */
export function feedQueryString(state: FeedState) {
  const params = new URLSearchParams()
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  if (state.mode === "matching") set("mode", state.mode)
  set("animalType", state.animalType)
  set("cityCode", state.cityCode)
  set("search", state.search)
  state.needTypes.forEach((code) => params.append("needType", code))
  set("priority", state.priority)
  set("needStatus", state.needStatus)
  if (state.point) {
    set("latitude", round(state.point.latitude))
    set("longitude", round(state.point.longitude))
    set("radiusKm", state.radiusKm)
  }
  if (state.orderBy !== "NEWEST") set("orderBy", state.orderBy)
  if (state.page > 0) set("page", state.page)
  return params.toString()
}

/** Applies a filter or mode change; any such change goes back to the first page. */
export function changeFeed(
  state: FeedState,
  patch: Partial<Omit<FeedState, "page">>,
): FeedState {
  return normalize({ ...state, ...patch, page: 0 })
}

/**
 * API parameters for the state; `sort` is never sent, the order goes as
 * `orderBy`. Pass `activeNeedTypes` (codes of enabled types from the
 * dictionary) to drop unknown or disabled codes, e.g. from an old link: the
 * backend rejects them with 400 UNKNOWN_NEED_TYPE. `cityCodes` does the same
 * for the city (400 UNKNOWN_CITY).
 */
export function toFeedFilter(
  state: FeedState,
  size: number,
  activeNeedTypes?: readonly string[],
  cityCodes?: readonly string[],
): CaseFeedFilter {
  const { point } = normalize(state)
  const needTypes = activeNeedTypes
    ? state.needTypes.filter((code) => activeNeedTypes.includes(code))
    : state.needTypes
  return {
    animalType: state.animalType,
    cityCode:
      state.cityCode && cityCodes && !cityCodes.includes(state.cityCode)
        ? undefined
        : state.cityCode,
    search: state.search || undefined,
    needType: needTypes.length ? needTypes : undefined,
    priority: state.priority,
    needStatus: state.needStatus,
    latitude: point && round(point.latitude),
    longitude: point && round(point.longitude),
    radiusKm: point ? state.radiusKm : undefined,
    orderBy: point || state.orderBy !== "DISTANCE" ? state.orderBy : "NEWEST",
    page: state.page,
    size,
  }
}

/** True when any filter differs from the defaults (the mode is not a filter). */
export function hasFeedFilters(state: FeedState) {
  return feedQueryString({ ...state, mode: "all", page: 0 }) !== ""
}

export type MapBounds = {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

/** True when the area can be requested: min below max, at most MAP_MAX_SPAN° per axis. */
export function isMapAreaAllowed(bounds: MapBounds) {
  const lat = bounds.maxLat - bounds.minLat
  const lng = bounds.maxLng - bounds.minLng
  return lat > 0 && lng > 0 && lat <= MAP_MAX_SPAN && lng <= MAP_MAX_SPAN
}

/** Map query: the feed filter without paging, point, radius and order. */
export function toMapFilter(
  filter: CaseFeedFilter,
  bounds: MapBounds,
): CaseMapFilter {
  return {
    animalType: filter.animalType,
    cityCode: filter.cityCode,
    search: filter.search,
    needType: filter.needType,
    priority: filter.priority,
    needStatus: filter.needStatus,
    ...bounds,
  }
}
