"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  RotateCcw,
  Search,
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
  changeFeed,
  feedQueryString,
  hasFeedFilters,
  parseFeedState,
  toFeedFilter,
  type FeedPoint,
  type FeedState,
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
  Card,
  CardHeader,
  CardTitle,
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
  CasePhoto,
  CaseCardsSkeleton,
  ListPagination,
  PageHeader,
  StatusBadge,
} from "@/components/common"
import { needStatusLabels } from "./statusLabels"
import { needPriorityLabels } from "./schemas"

const PAGE_SIZE = 6
const ALL = "all"

const FeedMap = dynamic(() => import("../Account/common/HomeAreaMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl sm:h-72" />,
})

const sortLabels: Record<CaseFeedSort, string> = {
  NEWEST: "Новые",
  DISTANCE: "Ближе ко мне",
  PRIORITY: "Срочные",
}

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
  // Unknown or disabled codes (e.g. from an old link) would get 400
  // UNKNOWN_NEED_TYPE, so codes are checked against the dictionary first.
  const filter = toFeedFilter(
    state,
    PAGE_SIZE,
    needTypes.data && sortedNeedTypes.map((type) => type.code),
  )
  const needTypeName = (code: string) =>
    getDictionaryName(needTypes.data, code, locale)
  const selectedNeedTypes = state.needTypes.filter((code) =>
    sortedNeedTypes.some((type) => type.code === code),
  )
  const cases = useQuery({
    queryKey: ["cases", "list", state.mode, filter],
    // The signal aborts the request once the filters move on.
    queryFn: ({ signal }) =>
      matching
        ? casesApi.matching(filter, signal)
        : casesApi.list(filter, signal),
    // "Подходит мне" waits for the session check; without a session the
    // authorized request fails with the usual 401.
    // Need type codes wait for the dictionary that validates them.
    enabled:
      (!matching || !authLoading) &&
      (!state.needTypes.length || !!needTypes.data),
  })
  const city = cities.data
    ?.flatMap((group) => group.cities)
    .find((item) => item.code === state.cityCode)

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Объявления"
        title="Кому сейчас нужна помощь"
        actions={
          <>
            {user && (
              <Button variant="outline" asChild className="h-11 sm:h-10">
                <Link href={ROUTES.MY_CASES}>Мои объявления</Link>
              </Button>
            )}
            <Button asChild className="h-11 sm:h-10">
              <Link href={ROUTES.CREATE_CASE}>Я нашёл животное</Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Какие объявления показать"
          className="flex w-full gap-1 rounded-full border bg-card p-1 sm:w-fit"
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
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground"
                  : "text-foreground",
              )}
              onClick={() => update({ mode })}
            >
              {label}
            </Button>
          ))}
        </div>
        {!user && !authLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock aria-hidden className="size-4 shrink-0" />
            «Подходит мне» доступно только авторизованным пользователям
          </p>
        )}
      </div>
      <div
        role="search"
        aria-label="Фильтры объявлений"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6"
      >
        {(hasFeedFilters(state) || searchText) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 self-end text-muted-foreground sm:-mt-2 sm:-mb-3 sm:h-8"
            onClick={reset}
          >
            <RotateCcw aria-hidden />
            Сбросить фильтры
          </Button>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="animal-filter">Тип животного</FieldLabel>
            <Select
              value={state.animalType ?? ALL}
              onValueChange={(value) =>
                update({
                  animalType: value === ALL ? undefined : (value as AnimalType),
                })
              }
            >
              <SelectTrigger id="animal-filter">
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
          <Field>
            <FieldLabel htmlFor="city-filter">Город</FieldLabel>
            <Select
              value={state.cityCode ?? ALL}
              onValueChange={(value) =>
                update({ cityCode: value === ALL ? undefined : value })
              }
            >
              <SelectTrigger id="city-filter">
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
          <Field>
            <FieldLabel htmlFor="search-filter">Поиск</FieldLabel>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="search-filter"
                type="search"
                placeholder="Поиск по заголовку и описанию"
                maxLength={FEED_SEARCH_MAX}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="pl-9"
              />
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="need-type-filter">Тип помощи</FieldLabel>
            {/* Several types at once: a case matches if it needs any of them. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  id="need-type-filter"
                  type="button"
                  className="flex h-12 w-full min-w-0 items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.03] px-4 text-left text-base shadow-xs transition-colors outline-none hover:border-primary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  <Heart aria-hidden className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">
                    {selectedNeedTypes.length === 0
                      ? "Любой тип помощи"
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
          <Field>
            <FieldLabel htmlFor="priority-filter">Приоритет</FieldLabel>
            <Select
              value={state.priority ?? ALL}
              onValueChange={(value) =>
                update({
                  priority: value === ALL ? undefined : (value as NeedPriority),
                })
              }
            >
              <SelectTrigger id="priority-filter">
                <CircleAlert aria-hidden className="text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Любой</SelectItem>
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {needPriorityLabels[priority]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="need-status-filter">
              Статус потребности
            </FieldLabel>
            <Select
              value={state.needStatus ?? ALL}
              onValueChange={(value) =>
                update({
                  needStatus: value === ALL ? undefined : (value as NeedStatus),
                })
              }
            >
              <SelectTrigger id="need-status-filter">
                <ListFilter aria-hidden className="text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Любой статус</SelectItem>
                  {(["OPEN", "ASSIGNED", "CLOSED"] as const).map((status) => (
                    <SelectItem key={status} value={status}>
                      {needStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border bg-background/60 p-3 sm:p-4 lg:flex-row lg:items-center">
          <fieldset className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <legend className="sr-only">Рядом со мной</legend>
            <p
              aria-hidden
              className="flex items-center gap-2 text-sm font-bold"
            >
              <MapPin className="size-4 text-primary" />
              Рядом со мной
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full sm:h-9"
                disabled={locating}
                onClick={locate}
              >
                <LocateFixed aria-hidden />
                {locating ? "Определяем…" : "Моё местоположение"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full sm:h-9"
                onClick={() => setMapOpen(true)}
              >
                <MapIcon aria-hidden />
                На карте
              </Button>
              {state.point ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-full sm:h-9"
                  onClick={() => update({ point: undefined })}
                >
                  <X aria-hidden />
                  Убрать точку
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Укажите точку, чтобы искать рядом
                </span>
              )}
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <label
                  htmlFor="radius-filter"
                  className="text-xs text-muted-foreground"
                >
                  Радиус
                </label>
                <span
                  className={cn(
                    "text-xs font-semibold",
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
          <div className="flex items-center gap-3 border-t pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
            <ArrowUpDown aria-hidden className="size-4 shrink-0 text-primary" />
            <div className="flex min-w-44 flex-1 flex-col gap-1">
              <label
                htmlFor="sort-filter"
                className="text-xs text-muted-foreground"
              >
                Сортировка
              </label>
              <Select
                value={state.orderBy}
                onValueChange={(value) =>
                  update({ orderBy: value as CaseFeedSort })
                }
              >
                <SelectTrigger id="sort-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(["NEWEST", "DISTANCE", "PRIORITY"] as const).map(
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

      {cases.isPending ? (
        <CaseCardsSkeleton />
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
        <>
          <p role="status" className="-mb-1 text-sm text-muted-foreground">
            Найдено объявлений: {cases.data.totalElements}
          </p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cases.data.content.map((item) => (
              <Link
                key={item.id}
                href={ROUTES.CASE_DETAILS(item.id)}
                className="group min-w-0 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <Card className="h-full min-w-0 pt-0 transition-colors group-hover:border-primary/30">
                  <CasePhoto src={item.photoUrl} alt={item.title} />
                  <CardHeader className="gap-3">
                    <CardTitle className="line-clamp-2 text-lg font-bold [overflow-wrap:anywhere]">
                      {item.title}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="primary" icon={PawPrint}>
                        {item.animalType === "CAT" ? "Кошка" : "Собака"}
                      </StatusBadge>
                      <StatusBadge icon={MapPin}>
                        {getCityName(cities.data, item.cityCode, locale)}
                      </StatusBadge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </>
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
