"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CloudOff, MapPin, PawPrint, Search, SlidersHorizontal } from "lucide-react"
import { casesApi, getErrorMessage } from "@/api"
import {
  useAuth,
  useCities,
  useDictionaryLocale,
  useDebouncedValue,
} from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName } from "@/lib/dictionaries"
import type { AnimalType } from "@/types"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Field,
  FieldLabel,
} from "@/components/ui"
import {
  EmptyState,
  FormAlert,
  CasePhoto,
  CaseCardsSkeleton,
  IconCircle,
  ListPagination,
  PageHeader,
  StatusBadge,
} from "@/components/common"

export function CasesList() {
  const { user } = useAuth()
  const locale = useDictionaryLocale()
  const cities = useCities()
  const [filters, setFilters] = useState({
    animalType: "all",
    cityCode: "all",
    title: "",
  })
  const search = useDebouncedValue(filters.title.trim())
  const [position, setPosition] = useState({
    page: 0,
    search: "",
    animalType: "all",
    cityCode: "all",
  })
  const matches =
    position.search === search &&
    position.animalType === filters.animalType &&
    position.cityCode === filters.cityCode
  const page = matches ? position.page : 0
  const setPage = (next: number) =>
    setPosition({
      page: next,
      search,
      animalType: filters.animalType,
      cityCode: filters.cityCode,
    })
  const cases = useQuery({
    queryKey: [
      "cases",
      "list",
      {
        animalType: filters.animalType,
        cityCode: filters.cityCode,
        title: search,
        page,
        size: 6,
      },
    ],
    queryFn: ({ signal }) =>
      casesApi.list(
        {
          animalType:
            filters.animalType === "all"
              ? undefined
              : (filters.animalType as AnimalType),
          cityCode: filters.cityCode === "all" ? undefined : filters.cityCode,
          title: search || undefined,
          page,
          size: 6,
        },
        signal,
      ),
  })
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
      <div
        role="search"
        aria-label="Фильтры объявлений"
        className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6 md:grid-cols-[auto_repeat(3,minmax(0,1fr))] md:items-end"
      >
        <span className="hidden md:mb-1 md:block">
          <IconCircle icon={SlidersHorizontal} />
        </span>
        <Field>
          <FieldLabel htmlFor="animal-filter">Тип животного</FieldLabel>
          <Select
            value={filters.animalType}
            onValueChange={(animalType) =>
              setFilters((current) => ({ ...current, animalType }))
            }
          >
            <SelectTrigger id="animal-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Все животные</SelectItem>
                <SelectItem value="CAT">Кошка</SelectItem>
                <SelectItem value="DOG">Собака</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="city-filter">Город</FieldLabel>
          <Select
            value={filters.cityCode}
            onValueChange={(cityCode) =>
              setFilters((current) => ({ ...current, cityCode }))
            }
          >
            <SelectTrigger id="city-filter">
              <SelectValue placeholder="Любой город" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Любой город</SelectItem>
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
          <FieldLabel htmlFor="title-filter">Название</FieldLabel>
          <Input
            id="title-filter"
            placeholder="Поиск по названию"
            value={filters.title}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
        </Field>
      </div>
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
      ) : (
        <EmptyState
          icon={Search}
          title="Ничего не нашлось"
          description="Пока нет объявлений по выбранным фильтрам."
        />
      )}
      {cases.data && (
        <ListPagination
          page={page}
          totalPages={cases.data.totalPages}
          busy={cases.isFetching}
          onPageChange={setPage}
        />
      )}
    </section>
  )
}
