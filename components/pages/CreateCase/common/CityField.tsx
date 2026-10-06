"use client"

import { useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useCities } from "@/hooks"
import { filterCities, getDictionaryName } from "@/lib/dictionaries"
import { FormAlert, FormField, Loader } from "@/components/common"
import {
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui"
import { CaseSelectField } from "./CaseSelectField"
import type { DictionaryLocale } from "@/types"
import type { CreateCaseValues } from "../schemas"

export function CityField({ locale }: { locale: DictionaryLocale }) {
  const cities = useCities()
  const [search, setSearch] = useState("")
  const {
    setValue,
    control,
    formState: { errors },
  } = useFormContext<CreateCaseValues>()
  const selected = useWatch({ control, name: "cityCode" })
  const groups = filterCities(cities.data || [], search)
  const allCities = cities.data?.flatMap((group) => group.cities) || []
  const selectedCity = allCities.find((city) => city.code === selected)
  const selectedVisible = groups.some((group) =>
    group.cities.some((city) => city.code === selected),
  )
  return (
    <div className="flex flex-col gap-5">
      {cities.isPending && <Loader label="Загружаем города…" />}
      {cities.isError && (
        <div className="flex flex-col gap-3">
          <FormAlert message={cities.error.message} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void cities.refetch()}
          >
            Загрузить города ещё раз
          </Button>
        </div>
      )}
      <Field>
        <FieldLabel htmlFor="city-search">Поиск города</FieldLabel>
        <Input
          id="city-search"
          type="text"
          inputMode="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Название города"
          disabled={!cities.data}
        />
      </Field>
      <CaseSelectField
        name="cityCode"
        label="Город"
        placeholder="Выберите город"
        disabled={!cities.data}
        onChange={(value) => {
          const city = allCities.find((item) => item.code === value)
          if (city) {
            setValue("latitude", String(city.latitude), {
              shouldValidate: true,
            })
            setValue("longitude", String(city.longitude), {
              shouldValidate: true,
            })
          }
        }}
      >
        <SelectGroup>
          {selectedCity && !selectedVisible && (
            <SelectItem value={selected}>
              {getDictionaryName([selectedCity], selected, locale)}
            </SelectItem>
          )}
        </SelectGroup>
        {groups.map((group) => (
          <SelectGroup key={group.region}>
            <SelectLabel>
              {getDictionaryName([group.center], group.center.code, locale)}
            </SelectLabel>
            {group.cities.map((city) => (
              <SelectItem key={city.code} value={city.code}>
                {getDictionaryName([city], city.code, locale)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </CaseSelectField>
      {cities.data && groups.length === 0 && (
        <FieldDescription>По этому запросу города не найдены.</FieldDescription>
      )}
      <details
        className="rounded-xl border p-4"
        open={!!errors.latitude || !!errors.longitude}
      >
        <summary className="cursor-pointer text-sm font-medium">
          Уточнить место находки
        </summary>
        <p className="my-4 text-sm text-muted-foreground">
          По умолчанию используем координаты выбранного города. Если знаете
          место находки, можете указать его координаты.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            name="latitude"
            label="Широта"
            inputMode="decimal"
            placeholder="53.9"
          />
          <FormField
            name="longitude"
            label="Долгота"
            inputMode="decimal"
            placeholder="27.56"
          />
        </div>
      </details>
    </div>
  )
}
