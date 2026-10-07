"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { casesApi } from "@/api"
import { useCities, useDictionaryLocale } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName } from "@/lib/dictionaries"
import { normalizeRemoteImageUrl } from "@/lib/images"
import type { AnimalType } from "@/types"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { FormAlert } from "@/components/common"

const animalTypeOptions: Array<{ value: AnimalType; label: string }> = [
  { value: "CAT", label: "Кошка" },
  { value: "DOG", label: "Собака" },
]

export function CasesList() {
  const locale = useDictionaryLocale()
  const cities = useCities()
  const [animalType, setAnimalType] = useState<AnimalType | "all">("all")
  const [cityCode, setCityCode] = useState("")
  const [title, setTitle] = useState("")

  const cases = useQuery({
    queryKey: [
      "cases",
      "list",
      { animalType, cityCode, title, page: 0, size: 20 },
    ],
    queryFn: () =>
      casesApi.list({
        animalType: animalType === "all" ? undefined : animalType,
        cityCode: cityCode || undefined,
        title: title.trim() || undefined,
        page: 0,
        size: 20,
      }),
  })

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">Объявления</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Кому сейчас нужна помощь
          </h1>
        </div>
        <Button asChild>
          <Link href={ROUTES.CREATE_CASE}>Я нашёл животное</Link>
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Тип животного</label>
          <Select
            value={animalType}
            onValueChange={(value) =>
              setAnimalType(value as AnimalType | "all")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {animalTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Город</label>
          <Select value={cityCode} onValueChange={setCityCode}>
            <SelectTrigger>
              <SelectValue placeholder="Любой город" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Любой город</SelectItem>
              {cities.data?.flatMap((group) =>
                group.cities.map((city) => (
                  <SelectItem key={city.code} value={city.code}>
                    {getCityName(cities.data, city.code, locale)}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Название</label>
          <Input
            placeholder="Поиск по названию"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>

      <FormAlert
        message={
          cases.error instanceof Error
            ? cases.error.message
            : cases.isError
              ? "Не удалось загрузить объявления."
              : undefined
        }
      />
      {cases.isLoading ? (
        <p className="text-muted-foreground">Загружаем объявления…</p>
      ) : cases.data?.content.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cases.data.content.map((item) => {
            const photoUrl = normalizeRemoteImageUrl(item.photoUrl)
            return (
              <Card key={item.id}>
                {photoUrl && (
                  <Image
                    src={photoUrl}
                    alt={item.title}
                    width={640}
                    height={360}
                    className="aspect-video w-full object-cover"
                  />
                )}
                <CardHeader>
                  <CardTitle>
                    <Link href={ROUTES.CASE_DETAILS(item.id)}>
                      {item.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    {item.animalType === "CAT" ? "Кошка" : "Собака"} ·{" "}
                    {getCityName(cities.data, item.cityCode, locale)}
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={ROUTES.CASE_DETAILS(item.id)}>Открыть</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Пока нет объявлений по выбранным фильтрам.
        </p>
      )}
    </section>
  )
}
