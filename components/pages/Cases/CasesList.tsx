"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
  CardDescription,
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
  FormAlert,
  CasePhoto,
  CaseCardsSkeleton,
  ListPagination,
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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-semibold text-primary">Объявления</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Кому сейчас нужна помощь
          </h1>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {user && (
            <Button variant="outline" asChild>
              <Link href={ROUTES.MY_CASES}>Мои объявления</Link>
            </Button>
          )}
          <Button asChild>
            <Link href={ROUTES.CREATE_CASE}>Я нашёл животное</Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-3">
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
        <Card className="items-start">
          <CardHeader className="w-full">
            <CardTitle>Не получилось загрузить объявления</CardTitle>
            <CardDescription>
              Возможно, пропал интернет или сервис ненадолго недоступен.
              Фильтры сохранятся — просто попробуйте ещё раз.
            </CardDescription>
            <FormAlert
              message={getErrorMessage(
                cases.error,
                "Не удалось загрузить объявления.",
              )}
            />
            <Button
              variant="outline"
              className="mt-2 w-fit"
              onClick={() => void cases.refetch()}
            >
              Попробовать ещё раз
            </Button>
          </CardHeader>
        </Card>
      ) : cases.data.content.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.data.content.map((item) => (
            <Link
              key={item.id}
              href={ROUTES.CASE_DETAILS(item.id)}
              className="group min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Card className="h-full min-w-0 pt-0 transition-shadow group-hover:shadow-md">
                <CasePhoto src={item.photoUrl} alt={item.title} />
                <CardHeader>
                  <CardTitle className="line-clamp-2 [overflow-wrap:anywhere]">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="[overflow-wrap:anywhere]">
                    {item.animalType === "CAT" ? "Кошка" : "Собака"} ·{" "}
                    {getCityName(cities.data, item.cityCode, locale)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-muted-foreground">
          Пока нет объявлений по выбранным фильтрам.
        </p>
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
