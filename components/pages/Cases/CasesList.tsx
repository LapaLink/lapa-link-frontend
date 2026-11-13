"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowRight,
  ArrowUpDown,
  Cat,
  ChevronDown,
  CircleAlert,
  CloudOff,
  HandHeart,
  Dog,
  Heart,
  LayoutGrid,
  List,
  ListFilter,
  LocateFixed,
  Map as MapIcon,
  PawPrint,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { ApiError, casesApi, getErrorMessage } from "@/api"
import {
  useAuth,
  useCities,
  useDictionaryLocale,
  useDebouncedValue,
  useNeedTypes,
} from "@/hooks"
import {
  FEED_DEFAULT_RADIUS_KM,
  FEED_SEARCH_MAX,
  changeFeed,
  feedQueryString,
  hasFeedFilters,
  isMapAreaAllowed,
  mergeFeedPages,
  parseFeedState,
  toFeedFilter,
  toMapFilter,
  type FeedPoint,
  type FeedState,
  type MapBounds,
} from "@/lib/cases"
import { ROUTES } from "@/lib/constants"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import type {
  AnimalType,
  CaseFeedSort,
  NeedPriority,
  NeedStatus,
} from "@/types"
import {
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Field,
  FieldLabel,
} from "@/components/ui"
import {
  EmptyState,
  FormAlert,
  ListPagination,
  LoadingButton,
} from "@/components/common"
import { needStatusLabels } from "./statusLabels"
import { CaseFeedCard, CaseFeedSkeleton } from "./CaseFeedCard"
import { CityFilter } from "./CityFilter"
import { needPriorityLabels } from "./schemas"

const PAGE_SIZE = 6
const ALL = "all"

const FeedMap = dynamic(() => import("../Account/common/HomeAreaMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl sm:h-72" />,
})

const CasesMap = dynamic(() => import("./CasesMap"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
})

// Without a city or a point the map opens over Minsk.
const DEFAULT_VIEW = { latitude: 53.9023, longitude: 27.5619, zoom: 11 }

/** Category chip of the feed toolbar (selected: dark, else white with a border). */
const chipButton = (on: boolean) =>
  cn(
    "flex h-11 items-center gap-2 rounded-full border-[1.5px] px-[18px] text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on
      ? "border-foreground bg-foreground text-background"
      : "border-input bg-card text-foreground hover:border-foreground/30",
  )

const sortLabels: Record<CaseFeedSort, string> = {
  NEWEST: "Новые",
  DISTANCE: "Ближе ко мне",
  PRIORITY: "Срочные",
  DEADLINE: "По сроку",
}

const mapLegend = [
  ["fill-primary", "Высокий"],
  ["fill-amber-500", "Средний"],
  ["fill-slate-500", "Низкий"],
  ["fill-slate-400", "Без потребностей"],
] as const

const geolocationHint =
  "Не удалось определить местоположение. Разрешите доступ к геолокации в браузере или выберите точку на карте."

function useDebouncedCommit<T>(initial: T, commit: (value: T) => void) {
  const [input, setInput] = useState({ source: initial, value: initial })
  // Browser history and links can replace URL filters without remounting
  // this component. Keep the editor in sync without committing an old draft.
  if (!Object.is(input.source, initial))
    setInput({ source: initial, value: initial })
  const draft = input.value
  const setDraft = (value: T) => setInput({ source: initial, value })
  const debounced = useDebouncedValue(draft)
  const applied = useRef(debounced)
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })
  useEffect(() => {
    if (Object.is(applied.current, debounced)) return
    applied.current = debounced
    commitRef.current(debounced)
  }, [debounced])
  return [draft, setDraft] as const
}

/**
 * Case feed with filters, order and the "Подходит мне" mode. All of it lives
 * in the URL query string (old `?title=` links map to `search`); any change
 * goes back to the first page. Needs a Suspense boundary (useSearchParams).
 */
export function CasesList() {
  const { user, isLoading: authLoading } = useAuth()
  const locale = useDictionaryLocale()
  const cities = useCities()
  const needTypes = useNeedTypes()
  const router = useRouter()
  const state = parseFeedState(useSearchParams())
  const [mapOpen, setMapOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [pointHint, setPointHint] = useState("")
  const [nearOpen, setNearOpen] = useState<boolean | null>(null)
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [showMap, setShowMap] = useState(true)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)

  const navigate = (next: FeedState) => {
    const query = feedQueryString(next)
    router.replace(query ? `${ROUTES.CASES}?${query}` : ROUTES.CASES, {
      scroll: false,
    })
  }
  const update = (patch: Partial<Omit<FeedState, "page">>) =>
    navigate(changeFeed(state, patch))

  const [searchText, setSearchText] = useDebouncedCommit(
    state.search,
    (value) => {
      const search = value.trim().slice(0, FEED_SEARCH_MAX)
      if (search !== state.search) update({ search })
    },
  )
  const [radius, setRadius] = useDebouncedCommit(
    state.radiusKm ?? FEED_DEFAULT_RADIUS_KM,
    (radiusKm) => {
      if (state.point && radiusKm !== state.radiusKm) update({ radiusKm })
    },
  )

  const setPoint = (point: FeedPoint) => {
    setPointHint("")
    const radiusKm = state.radiusKm ?? FEED_DEFAULT_RADIUS_KM
    setRadius(radiusKm)
    update({ point, radiusKm })
  }
  function locate() {
    const fail = () => {
      setLocating(false)
      setPointHint(geolocationHint)
      // A denied location must not leave radius or DISTANCE without a point.
      if (state.point || state.orderBy === "DISTANCE")
        update({ point: undefined })
    }
    if (!navigator.geolocation) return fail()
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        setPoint({ latitude: coords.latitude, longitude: coords.longitude })
      },
      fail,
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    )
  }
  function reset() {
    setSearchText("")
    setRadius(FEED_DEFAULT_RADIUS_KM)
    setPointHint("")
    navigate(
      changeFeed(parseFeedState(new URLSearchParams()), { mode: state.mode }),
    )
  }

  const matching = state.mode === "matching"
  const sortedNeedTypes = (needTypes.data ?? [])
    .filter((type) => type.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const allCities = cities.data?.flatMap((group) => group.cities)
  // Unknown or disabled codes (e.g. from an old link) would get 400
  // UNKNOWN_NEED_TYPE or UNKNOWN_CITY, so they are checked against the
  // dictionaries first.
  const filter = toFeedFilter(
    state,
    PAGE_SIZE,
    needTypes.data && sortedNeedTypes.map((type) => type.code),
    allCities?.map((item) => item.code),
  )
  const needTypeName = (code: string) =>
    getDictionaryName(needTypes.data, code, locale)
  const selectedNeedTypes = state.needTypes.filter((code) =>
    sortedNeedTypes.some((type) => type.code === code),
  )
  const feedReady =
    (!matching || !authLoading) &&
    (!state.needTypes.length || !!needTypes.data) &&
    (!state.cityCode || !!cities.data)
  // "Подходит мне" keeps page numbers: the cursor is not supported there.
  const matchingFeed = useQuery({
    queryKey: ["cases", "list", "matching", filter],
    queryFn: ({ signal }) => casesApi.matching(filter, signal),
    // It waits for the session check; without a session the authorized
    // request fails with the usual 401. Need type and city codes wait for
    // the dictionaries that validate them.
    enabled: feedReady && matching,
  })
  // The public feed loads by cursor ("Показать ещё"). Any change of filters
  // or order is a new key, so the list restarts from an empty cursor.
  const cursorFilter = { ...filter, page: undefined }
  const cursorFeed = useInfiniteQuery({
    queryKey: ["cases", "list", "cursor", cursorFilter],
    queryFn: ({ pageParam, signal }) =>
      casesApi.list({ ...cursorFilter, cursor: pageParam }, signal),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: feedReady && !matching,
  })
  const cases = matching ? matchingFeed : cursorFeed
  const feedItems = matching
    ? matchingFeed.data?.content
    : cursorFeed.data && mergeFeedPages(cursorFeed.data.pages)
  // A broken cursor is not for the user: start the list over, silently.
  const cursorBroken =
    !matching &&
    cursorFeed.error instanceof ApiError &&
    cursorFeed.error.code === "INVALID_CURSOR"
  const client = useQueryClient()
  useEffect(() => {
    if (cursorBroken)
      void client.resetQueries({ queryKey: ["cases", "list", "cursor"] })
  }, [cursorBroken, client])
  const city = allCities?.find((item) => item.code === state.cityCode)
  const homePoint =
    user?.homeLatitude != null && user.homeLongitude != null
      ? { latitude: user.homeLatitude, longitude: user.homeLongitude }
      : undefined
  const mapView = state.point
    ? { ...state.point, zoom: 12 }
    : city
      ? { latitude: city.latitude, longitude: city.longitude, zoom: 11 }
      : homePoint
        ? { ...homePoint, zoom: 12 }
        : DEFAULT_VIEW
  // Areas over MAP_MAX_SPAN° are not requested (400 INVALID_BOUNDS).
  const mapFilter =
    mapBounds && isMapAreaAllowed(mapBounds)
      ? toMapFilter(filter, mapBounds)
      : null
  const markers = useQuery({
    queryKey: ["cases", "list", "map", state.mode, mapFilter],
    queryFn: ({ signal }) =>
      matching
        ? casesApi.matchingMap(mapFilter!, signal)
        : casesApi.map(mapFilter!, signal),
    enabled: feedReady && !!mapFilter,
    // Markers stay while the next area loads.
    placeholderData: keepPreviousData,
  })

  // A dictionary can become stale while the feed is open. Its fresh data
  // changes the filter/query key, so recovery does not retry invalid codes.
  const filterError = [cases.error, markers.error].find(
    (error) => error instanceof ApiError && error.code === "UNKNOWN_NEED_TYPE",
  )
  const refreshNeedTypes = needTypes.refetch
  useEffect(() => {
    if (
      filterError instanceof ApiError &&
      filterError.code === "UNKNOWN_NEED_TYPE"
    )
      void refreshNeedTypes()
  }, [filterError, refreshNeedTypes])
  const requestedCodes = state.needTypes.join(",")
  const availableCodes = selectedNeedTypes.join(",")
  const cleanedQuery = feedQueryString(
    changeFeed(state, { needTypes: selectedNeedTypes }),
  )
  const dictionaryReady = !!needTypes.data
  useEffect(() => {
    if (dictionaryReady && requestedCodes !== availableCodes)
      router.replace(
        cleanedQuery ? `${ROUTES.CASES}?${cleanedQuery}` : ROUTES.CASES,
        { scroll: false },
      )
  }, [dictionaryReady, requestedCodes, availableCodes, cleanedQuery, router])

  const nearVisible = nearOpen ?? !!state.point
  const advancedCount =
    Number(!!state.point) +
    Number(!!state.priority) +
    Number(!!state.needStatus)
  const moreVisible = moreOpen ?? advancedCount > 0
  const activeFilterCount = [
    state.animalType,
    state.cityCode,
    state.search,
    state.priority,
    state.needStatus,
    state.point,
  ].filter(Boolean).length
  // Neutral fields: the burgundy accent is kept for actions. The value sits
  // next to the icon instead of the trigger's center.
  const fieldClass =
    "border-input bg-background hover:border-foreground/25 focus-visible:bg-background *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-left"
  const chipClass = "h-11 rounded-full sm:h-9"

  return (
    <section className="mx-auto flex w-full min-w-0 flex-col gap-5">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-r from-primary-soft via-peach/70 to-primary-soft px-6 py-8 sm:px-10 sm:py-10">
        <svg
          aria-hidden
          viewBox="0 0 220 200"
          className="absolute right-4 bottom-0 -z-10 hidden h-[92%] sm:block"
        >
          <ellipse
            cx="120"
            cy="196"
            rx="100"
            ry="14"
            className="fill-primary/10"
          />
          <path
            d="M150 120c30-10 50 10 42 40-4 14-20 8-26-4z"
            className="fill-[#c97b3e]"
          />
          <rect
            x="62"
            y="96"
            width="96"
            height="92"
            rx="40"
            className="fill-white"
          />
          <path d="M60 120l8 52 24-8z" className="fill-primary" />
          <ellipse cx="96" cy="64" rx="52" ry="48" className="fill-white" />
          <path
            d="M52 40c-22 6-26 44-12 62 14-4 22-30 20-50z"
            className="fill-[#c97b3e]"
          />
          <path
            d="M138 30c26 0 34 30 22 52-14-6-24-26-22-52z"
            className="fill-[#c97b3e]"
          />
          <path
            d="M96 22c18 0 26 14 22 34-10-8-26-8-40 0-2-20 4-34 18-34z"
            className="fill-[#c97b3e]"
          />
          <circle cx="78" cy="68" r="6" className="fill-foreground" />
          <circle cx="116" cy="68" r="6" className="fill-foreground" />
          <ellipse cx="97" cy="84" rx="9" ry="6" className="fill-foreground" />
          <path d="M84 94c6 12 22 12 26 0z" className="fill-primary/70" />
        </svg>
        <PawPrint
          aria-hidden
          className="absolute -right-6 -bottom-8 -z-10 size-56 rotate-12 text-primary/10 sm:hidden"
        />
        <PawPrint
          aria-hidden
          className="absolute right-40 top-4 -z-10 hidden size-16 -rotate-12 text-primary/10 sm:block"
        />
        <h1 className="max-w-lg text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
          Каждое животное <span className="text-primary">заслуживает дом</span>
        </h1>
        <p className="mt-2 text-lg text-foreground/75">
          Помогите найти любящего хозяина
        </p>
        <Button asChild size="lg" className="mt-5 rounded-full">
          <Link href={ROUTES.FAQ}>
            Узнать больше
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="group"
          aria-label="Кого показать"
          className="flex flex-wrap items-center gap-2.5"
        >
          {(
            [
              [undefined, "Все", PawPrint],
              ["DOG", "Собаки", Dog],
              ["CAT", "Кошки", Cat],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={label}
              type="button"
              aria-pressed={state.animalType === value}
              className={chipButton(state.animalType === value)}
              onClick={() => update({ animalType: value })}
            >
              <Icon aria-hidden className="size-[18px]" />
              {label}
            </button>
          ))}
        </div>
        <span aria-hidden className="mx-1 hidden h-7 w-px bg-input sm:block" />
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="feed-filters"
          className={chipButton(false)}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden className="size-[18px]" />
          Фильтры
          {activeFilterCount > 0 && (
            <span className="flex size-[22px] items-center justify-center rounded-full bg-foreground text-xs text-background">
              {activeFilterCount}
            </span>
          )}
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
          <Switch
            checked={matching}
            onCheckedChange={(on) => {
              // "Подходит мне" needs an account: guests go to sign in.
              if (on && !user) {
                if (!authLoading) router.push(ROUTES.LOGIN)
                return
              }
              update({ mode: on ? "matching" : "all" })
            }}
          />
          Подходит мне
        </label>
      </div>
      <div
        id="feed-filters"
        role="search"
        aria-label="Фильтры объявлений"
        className={cn(
          "flex-col gap-3 rounded-2xl border border-foreground/[0.07] bg-card p-4 shadow-card sm:p-5",
          filtersOpen ? "flex" : "hidden",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="animal-filter">Тип животного</FieldLabel>
            <Select
              value={state.animalType ?? ALL}
              onValueChange={(value) =>
                update({
                  animalType: value === ALL ? undefined : (value as AnimalType),
                })
              }
            >
              <SelectTrigger
                id="animal-filter"
                className={cn("data-[size=default]:h-11", fieldClass)}
              >
                <PawPrint aria-hidden className="text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Все животные</SelectItem>
                  <SelectItem value="CAT">Кошка</SelectItem>
                  <SelectItem value="DOG">Собака</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="city-filter">Город</FieldLabel>
            <CityFilter
              id="city-filter"
              value={state.cityCode}
              options={(allCities ?? []).map((item) => ({
                code: item.code,
                name: getCityName(cities.data, item.code, locale),
              }))}
              fieldClass={fieldClass}
              onChange={(cityCode) => update({ cityCode })}
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="need-type-filter">Тип помощи</FieldLabel>
            {/* Several types at once: a case matches if it needs any of them. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="need-type-filter"
                  type="button"
                  className={cn(
                    "flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border px-4 text-left text-base shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
                    fieldClass,
                  )}
                >
                  <Heart aria-hidden className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">
                    {selectedNeedTypes.length === 0
                      ? "Любой тип"
                      : selectedNeedTypes.length === 1
                        ? needTypeName(selectedNeedTypes[0])
                        : `${needTypeName(selectedNeedTypes[0])} и ещё ${selectedNeedTypes.length - 1}`}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                {sortedNeedTypes.map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type.code}
                    className="min-h-10"
                    checked={selectedNeedTypes.includes(type.code)}
                    // Keep the menu open to tick several types.
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) =>
                      update({
                        needTypes: checked
                          ? [...selectedNeedTypes, type.code]
                          : selectedNeedTypes.filter(
                              (code) => code !== type.code,
                            ),
                      })
                    }
                  >
                    {needTypeName(type.code)}
                  </DropdownMenuCheckboxItem>
                ))}
                {selectedNeedTypes.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="min-h-10"
                      onSelect={() => update({ needTypes: [] })}
                    >
                      <X aria-hidden />
                      Любой тип помощи
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="search-filter">Поиск</FieldLabel>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="search-filter"
                type="search"
                placeholder="Название или описание"
                maxLength={FEED_SEARCH_MAX}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={cn("h-11 pl-9", fieldClass)}
              />
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={moreVisible ? "secondary" : "outline"}
            className={chipClass}
            aria-expanded={moreVisible}
            aria-controls="feed-more-filters"
            onClick={() => setMoreOpen(!moreVisible)}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Ещё фильтры
            {advancedCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                <span className="sr-only">активных: </span>
                {advancedCount}
              </span>
            )}
            <ChevronDown
              data-icon="inline-end"
              className={cn(moreVisible && "rotate-180")}
            />
          </Button>
          {(hasFeedFilters(state) || searchText) && (
            <Button
              type="button"
              variant="ghost"
              className={cn(chipClass, "ml-auto text-foreground/80")}
              onClick={reset}
            >
              <RotateCcw aria-hidden />
              Сбросить фильтры
            </Button>
          )}
        </div>
        <div id="feed-more-filters" hidden={!moreVisible}>
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  chipClass,
                  "flex-1 sm:flex-none",
                  nearVisible &&
                    "border-primary/40 bg-primary-soft text-primary",
                )}
                aria-expanded={nearVisible}
                aria-controls="near-filter"
                onClick={() => setNearOpen(!nearVisible)}
              >
                <LocateFixed aria-hidden />
                Рядом со мной
              </Button>
              <Select
                value={state.priority ?? ALL}
                onValueChange={(value) =>
                  update({
                    priority:
                      value === ALL ? undefined : (value as NeedPriority),
                  })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Приоритет"
                  className={cn(
                    "w-auto gap-2 rounded-full px-3 text-sm data-[size=sm]:h-11 sm:data-[size=sm]:h-9",
                    fieldClass,
                  )}
                >
                  <CircleAlert aria-hidden className="text-primary" />
                  <span className="text-muted-foreground">Приоритет:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>любой</SelectItem>
                    {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {needPriorityLabels[priority]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={state.needStatus ?? ALL}
                onValueChange={(value) =>
                  update({
                    needStatus:
                      value === ALL ? undefined : (value as NeedStatus),
                  })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Статус потребности"
                  className={cn(
                    "w-auto gap-2 rounded-full px-3 text-sm data-[size=sm]:h-11 sm:data-[size=sm]:h-9",
                    fieldClass,
                  )}
                >
                  <ListFilter aria-hidden className="text-primary" />
                  <span className="text-muted-foreground">Статус:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>любой</SelectItem>
                    {(["OPEN", "ASSIGNED", "CLOSED"] as const).map((status) => (
                      <SelectItem key={status} value={status}>
                        {needStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {nearVisible && (
              <fieldset
                id="near-filter"
                className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <legend className="sr-only">Рядом со мной</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={chipClass}
                    disabled={locating}
                    onClick={locate}
                  >
                    <LocateFixed aria-hidden />
                    {locating ? "Определяем…" : "Моё местоположение"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={chipClass}
                    onClick={() => setMapOpen(true)}
                  >
                    <MapIcon aria-hidden />
                    На карте
                  </Button>
                  {state.point ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className={chipClass}
                      onClick={() => update({ point: undefined })}
                    >
                      <X aria-hidden />
                      Убрать точку
                    </Button>
                  ) : (
                    <span className="text-sm text-foreground/75">
                      Укажите точку, чтобы искать рядом
                    </span>
                  )}
                </div>
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <div className="flex items-baseline gap-3">
                    <label
                      htmlFor="radius-filter"
                      className="text-sm text-foreground/75"
                    >
                      Радиус
                    </label>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        !state.point && "text-muted-foreground",
                      )}
                    >
                      {radius} км
                    </span>
                  </div>
                  <input
                    id="radius-filter"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={radius}
                    disabled={!state.point}
                    aria-valuetext={`до ${radius} км`}
                    onChange={(event) => setRadius(Number(event.target.value))}
                    className="h-7 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </fieldset>
            )}
          </div>
        </div>
        <FormAlert message={pointHint} />
      </div>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Точка для поиска рядом</DialogTitle>
            <DialogDescription>
              Нажмите на карту — покажем объявления в выбранном радиусе от этой
              точки.
            </DialogDescription>
          </DialogHeader>
          <FeedMap
            point={state.point ?? null}
            city={
              city
                ? { latitude: city.latitude, longitude: city.longitude }
                : null
            }
            onPick={setPoint}
          />
          <DialogFooter>
            <Button type="button" onClick={() => setMapOpen(false)}>
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "grid gap-6 lg:items-start",
          showMap && "lg:grid-cols-[minmax(0,1fr)_380px]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-[28px] font-bold tracking-tight">
                Питомцы ждут помощи рядом
              </h2>
              {feedItems && (
                <p role="status" className="text-sm text-foreground/75">
                  {matching
                    ? `Найдено объявлений: ${matchingFeed.data?.totalElements}`
                    : `Показано объявлений: ${feedItems.length}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={state.orderBy}
                onValueChange={(value) =>
                  update({ orderBy: value as CaseFeedSort })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Сортировка"
                  className={cn(
                    "w-auto gap-2 rounded-full px-3 text-sm data-[size=sm]:h-11 sm:data-[size=sm]:h-9",
                    fieldClass,
                  )}
                >
                  <ArrowUpDown aria-hidden className="text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    {(
                      ["NEWEST", "DISTANCE", "PRIORITY", "DEADLINE"] as const
                    ).map((orderBy) => (
                      <SelectItem
                        key={orderBy}
                        value={orderBy}
                        // Ordering by distance needs a point (FEED_POINT_REQUIRED).
                        disabled={orderBy === "DISTANCE" && !state.point}
                      >
                        {sortLabels[orderBy]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <button
                type="button"
                aria-label="Показать карту"
                aria-pressed={showMap}
                title="Карта"
                onClick={() => setShowMap((on) => !on)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  showMap
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground/70 hover:border-foreground/30",
                )}
              >
                <MapIcon aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                aria-label={
                  view === "grid" ? "Показать списком" : "Показать сеткой"
                }
                title={view === "grid" ? "Списком" : "Сеткой"}
                onClick={() =>
                  setView((current) => (current === "grid" ? "list" : "grid"))
                }
                className="flex size-10 items-center justify-center rounded-xl border border-input bg-card text-foreground/70 transition-colors outline-none hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {view === "grid" ? (
                  <List aria-hidden className="size-5" />
                ) : (
                  <LayoutGrid aria-hidden className="size-5" />
                )}
              </button>
            </div>
          </div>

          {cases.isPending || cursorBroken ? (
            <CaseFeedSkeleton />
          ) : cases.isError && !feedItems?.length ? (
            <EmptyState
              icon={CloudOff}
              title="Не получилось загрузить объявления"
              description="Возможно, пропал интернет или сервис ненадолго недоступен. Фильтры сохранятся — просто попробуйте ещё раз."
            >
              <FormAlert
                message={getErrorMessage(
                  cases.error,
                  "Не удалось загрузить объявления.",
                )}
              />
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => void cases.refetch()}
              >
                Попробовать ещё раз
              </Button>
            </EmptyState>
          ) : feedItems?.length ? (
            <div
              className={cn(
                "grid gap-5",
                view === "list"
                  ? "grid-cols-1"
                  : showMap
                    ? "sm:grid-cols-2 xl:grid-cols-3"
                    : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
              )}
            >
              {feedItems.map((item) => (
                <CaseFeedCard
                  key={item.id}
                  item={item}
                  layout={view}
                  cityName={getCityName(cities.data, item.cityCode, locale)}
                  needTypeName={needTypeName}
                />
              ))}
            </div>
          ) : matching ? (
            <EmptyState
              icon={HandHeart}
              title="Нет подходящих объявлений"
              description="Здесь появятся объявления, где нужна помощь, которую вы отметили в профиле, — в вашем радиусе или в городе профиля."
            >
              <Button asChild variant="outline" className="h-11 sm:h-10">
                <Link href={`${ROUTES.ACCOUNT}#help-offers`}>
                  Настроить, чем готов помочь
                </Link>
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icon={Search}
              title="Ничего не нашлось"
              description="Пока нет объявлений по выбранным фильтрам."
            />
          )}
          {matching && matchingFeed.data && (
            <ListPagination
              page={state.page}
              totalPages={matchingFeed.data.totalPages}
              busy={matchingFeed.isFetching}
              onPageChange={(page) => navigate({ ...state, page })}
            />
          )}
          {!matching && !!feedItems?.length && (
            <div className="flex flex-col items-center gap-3">
              {cursorFeed.isError && (
                <FormAlert
                  message={getErrorMessage(
                    cursorFeed.error,
                    "Не удалось загрузить объявления.",
                  )}
                />
              )}
              {cursorFeed.hasNextPage && (
                <LoadingButton
                  variant="outline"
                  className="h-11 px-8 sm:h-10"
                  loading={cursorFeed.isFetchingNextPage}
                  loadingText="Загружаем…"
                  onClick={() => void cursorFeed.fetchNextPage()}
                >
                  Показать ещё
                </LoadingButton>
              )}
            </div>
          )}
        </div>
        {showMap && (
          <section
            aria-labelledby="cases-map-title"
            className="order-first flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:order-none"
          >
            <h2
              id="cases-map-title"
              className="flex items-center gap-2 text-xl font-bold"
            >
              <MapIcon aria-hidden className="size-5 text-primary" />
              Карта объявлений
            </h2>
            {/* `isolate` keeps Leaflet's high z-index panes under the sticky header. */}
            <div className="relative isolate h-72 overflow-hidden rounded-[28px] border border-foreground/[0.07] shadow-card sm:h-[28rem] lg:h-[36rem]">
              <CasesMap
                view={mapView}
                point={state.point}
                homePoint={homePoint}
                radiusKm={state.point ? radius : undefined}
                items={(mapFilter && markers.data?.items) || []}
                needTypeName={needTypeName}
                onBoundsChange={setMapBounds}
              />
              {(mapBounds && !mapFilter) ||
              markers.data?.truncated ||
              markers.isError ? (
                <p
                  role="status"
                  className="absolute inset-x-14 top-3 z-[1000] mx-auto w-fit rounded-xl bg-card/95 px-3 py-2 text-center text-sm font-semibold shadow-sm"
                >
                  {mapBounds && !mapFilter
                    ? "Приблизьте карту, чтобы увидеть объявления"
                    : markers.isError
                      ? getErrorMessage(
                          markers.error,
                          "Не удалось загрузить метки на карте.",
                        )
                      : "Показаны не все объявления — приблизьте карту"}
                </p>
              ) : null}
            </div>
            <ul
              aria-label="Цвет метки — приоритет"
              className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-foreground/75"
            >
              {mapLegend.map(([fill, label]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <svg aria-hidden viewBox="0 0 10 10" className="size-2.5">
                    <circle cx="5" cy="5" r="5" className={fill} />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  )
}
