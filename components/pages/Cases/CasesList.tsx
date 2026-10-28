"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowUpDown,
  ChevronDown,
  CircleAlert,
  CloudOff,
  HandHeart,
  Heart,
  ListFilter,
  LocateFixed,
  Lock,
  Map as MapIcon,
  MapPin,
  PawPrint,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { casesApi, getErrorMessage } from "@/api"
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
  MAP_MAX_SPAN,
  changeFeed,
  feedQueryString,
  hasFeedFilters,
  isMapAreaAllowed,
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
  Field,
  FieldLabel,
} from "@/components/ui"
import {
  EmptyState,
  FormAlert,
  ListPagination,
  PageHeader,
} from "@/components/common"
import { needStatusLabels } from "./statusLabels"
import { CaseFeedCard, CaseFeedSkeleton } from "./CaseFeedCard"
import { UrgentCases } from "./UrgentCases"
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
  ["fill-sky-500", "Вы здесь"],
] as const

const geolocationHint =
  "Не удалось определить местоположение. Разрешите доступ к геолокации в браузере или выберите точку на карте."


function useDebouncedCommit<T>(initial: T, commit: (value: T) => void) {
  const [draft, setDraft] = useState(initial)
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
  const [nearOpen, setNearOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  const cases = useQuery({
    queryKey: ["cases", "list", state.mode, filter],
    // The signal aborts the request once the filters move on.
    queryFn: ({ signal }) =>
      matching
        ? casesApi.matching(filter, signal)
        : casesApi.list(filter, signal),
    // "Подходит мне" waits for the session check; without a session the
    // authorized request fails with the usual 401.
    // Need type and city codes wait for the dictionaries that validate them.
    enabled: feedReady,
  })
  const city = allCities?.find((item) => item.code === state.cityCode)
  const mapView = state.point
    ? { ...state.point, zoom: 12 }
    : city
      ? { latitude: city.latitude, longitude: city.longitude, zoom: 11 }
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

  const nearVisible = nearOpen || !!state.point
  const moreVisible = moreOpen || !!state.needStatus
  // Neutral fields: the burgundy accent is kept for actions. The value sits
  // next to the icon instead of the trigger's center.
  const fieldClass =
    "border-input bg-background hover:border-foreground/25 focus-visible:bg-background *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:text-left"
  const chipClass = "h-11 rounded-full sm:h-9"

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Помощь животным"
        title="Кому нужна помощь?"
        description="Найдите животное или помогите тем, кто рядом с вами."
        actions={
          <>
            {user && (
              <Button variant="outline" asChild className="h-11 sm:h-10">
                <Link href={ROUTES.MY_CASES}>Мои объявления</Link>
              </Button>
            )}
            <Button
              asChild
              className="h-11 px-5 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25"
            >
              <Link href={ROUTES.CREATE_CASE}>
                <Plus aria-hidden />
                Создать объявление
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Какие объявления показать"
          className="flex w-full gap-1 rounded-full border border-foreground/[0.07] bg-card p-1 shadow-card sm:w-fit"
        >
          {(
            [
              ["all", "Все объявления"],
              ["matching", "Подходит мне"],
            ] as const
          ).map(([mode, label]) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              aria-pressed={state.mode === mode}
              // "Подходит мне" needs an account: guests see it locked.
              disabled={mode === "matching" && !user}
              className={cn(
                "h-11 flex-1 rounded-full px-5 sm:h-10 sm:flex-none",
                state.mode === mode
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground",
              )}
              onClick={() => update({ mode })}
            >
              {label}
            </Button>
          ))}
        </div>
        {!user && !authLoading && (
          <p className="flex items-center gap-2 text-sm text-foreground/75">
            <Lock aria-hidden className="size-4 shrink-0" />
            «Подходит мне» доступно только авторизованным пользователям
          </p>
        )}
      </div>
      <div
        role="search"
        aria-label="Фильтры объявлений"
        className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.07] bg-card p-4 shadow-card sm:p-5"
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
            <Select
              value={state.cityCode ?? ALL}
              onValueChange={(value) =>
                update({ cityCode: value === ALL ? undefined : value })
              }
            >
              <SelectTrigger
                id="city-filter"
                className={cn("data-[size=default]:h-11", fieldClass)}
              >
                <MapPin aria-hidden className="text-primary" />
                <SelectValue placeholder="Любой город" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Любой город</SelectItem>
                  {cities.data?.flatMap((group) =>
                    group.cities.map((city) => (
                      <SelectItem key={city.code} value={city.code}>
                        {getCityName(cities.data, city.code, locale)}
                      </SelectItem>
                    )),
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
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
            variant="outline"
            className={cn(
              chipClass,
              "flex-1 sm:flex-none",
              nearVisible && "border-primary/40 bg-primary-soft text-primary",
            )}
            aria-expanded={nearVisible}
            aria-controls="near-filter"
            onClick={() => {
              // Closing the panel also drops the point it set.
              if (nearVisible && state.point) update({ point: undefined })
              setNearOpen(!nearVisible)
            }}
          >
            <LocateFixed aria-hidden />
            Рядом со мной
          </Button>
          {/* On phones the rest folds behind "Фильтры" to leave room for cases. */}
          <Button
            type="button"
            variant="outline"
            className={cn(
              chipClass,
              "flex-1 sm:hidden",
              filtersOpen && "border-primary/40 bg-primary-soft text-primary",
            )}
            aria-expanded={filtersOpen}
            aria-controls="feed-more-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal aria-hidden />
            Фильтры
            {(state.priority || state.needStatus) && (
              <span aria-hidden className="size-2 rounded-full bg-primary" />
            )}
          </Button>
          <div
            id="feed-more-filters"
            className={cn(
              "w-full flex-wrap items-center gap-2 sm:contents",
              filtersOpen ? "flex" : "hidden",
            )}
          >
          <Select
            value={state.priority ?? ALL}
            onValueChange={(value) =>
              update({
                priority: value === ALL ? undefined : (value as NeedPriority),
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
          {moreVisible ? (
            <Select
              value={state.needStatus ?? ALL}
              onValueChange={(value) =>
                update({
                  needStatus: value === ALL ? undefined : (value as NeedStatus),
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
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={cn(chipClass, "text-foreground/80")}
              onClick={() => setMoreOpen(true)}
            >
              <Plus aria-hidden />
              Ещё фильтры
            </Button>
          )}
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

      <div className="grid gap-5 lg:grid-cols-5">
        <section
          aria-label="Карта объявлений"
          className="relative flex min-w-0 flex-col gap-2 lg:col-span-3"
        >
          {/* `isolate` keeps Leaflet's high z-index panes under the sticky header. */}
          <div className="relative isolate h-72 overflow-hidden rounded-2xl border border-foreground/[0.07] shadow-card sm:h-96">
            <CasesMap
              view={mapView}
              point={state.point}
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
                className="absolute inset-x-3 top-3 z-[1000] mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-xl bg-card/95 px-3 py-2 text-center text-sm font-semibold shadow-sm"
              >
                {mapBounds && !mapFilter
                  ? `Приблизьте карту: показываем область не больше ${MAP_MAX_SPAN}° по стороне`
                  : markers.isError
                    ? getErrorMessage(
                        markers.error,
                        "Не удалось загрузить метки на карте.",
                      )
                    : "Показаны не все объявления — приблизьте карту"}
              </p>
            ) : null}
          </div>
          {/* Over the map's corner from sm up; under it on phones. */}
          <ul
            aria-label="Цвет метки — приоритет"
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/75 sm:absolute sm:bottom-3 sm:left-3 sm:z-[1000] sm:max-w-[calc(100%-15rem)] sm:rounded-lg sm:bg-card/95 sm:px-2.5 sm:py-1.5 sm:shadow-sm sm:backdrop-blur"
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
        <div className="lg:col-span-2">
          <UrgentCases
            filter={filter}
            enabled={feedReady}
            cityName={(code) => getCityName(cities.data, code, locale)}
            needTypeName={needTypeName}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Объявления
          </h2>
          {cases.data && (
            <p role="status" className="text-sm text-foreground/75">
              Найдено объявлений: {cases.data.totalElements}
            </p>
          )}
        </div>
        <Select
          value={state.orderBy}
          onValueChange={(value) => update({ orderBy: value as CaseFeedSort })}
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
              {(["NEWEST", "DISTANCE", "PRIORITY", "DEADLINE"] as const).map(
                (orderBy) => (
                <SelectItem
                  key={orderBy}
                  value={orderBy}
                  // Ordering by distance needs a point (FEED_POINT_REQUIRED).
                  disabled={orderBy === "DISTANCE" && !state.point}
                >
                  {sortLabels[orderBy]}
                </SelectItem>
                ),
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {cases.isPending ? (
        <CaseFeedSkeleton />
      ) : cases.isError ? (
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
      ) : cases.data.content.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.data.content.map((item) => (
            <CaseFeedCard
              key={item.id}
              item={item}
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
      {cases.data && (
        <ListPagination
          page={state.page}
          totalPages={cases.data.totalPages}
          busy={cases.isFetching}
          onPageChange={(page) => navigate({ ...state, page })}
        />
      )}
    </section>
  )
}
