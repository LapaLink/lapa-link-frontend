"use client"

import { useState } from "react"
import { useController, useFormContext } from "react-hook-form"
import { Check, ChevronDown, LocateFixed, MapPin } from "lucide-react"
import { useCities } from "@/hooks"
import { filterCities, getDictionaryName } from "@/lib/dictionaries"
import {
  FormAlert,
  FormField,
  Loader,
  LoadingButton,
} from "@/components/common"
import {
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui"
import type { DictionaryLocale } from "@/types"

export function CaseCityField({
  locale,
  withCoordinates = false,
  optional = false,
}: {
  locale: DictionaryLocale
  withCoordinates?: boolean
  optional?: boolean
}) {
  const cities = useCities()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const {
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useFormContext()
  const { field, fieldState } = useController({ control, name: "cityCode" })
  const selected = field.value
  const groups = filterCities(cities.data || [], search)
  const allCities = cities.data?.flatMap((group) => group.cities) || []
  const selectedCity = allCities.find((city) => city.code === selected)
  function choose(value: string) {
    field.onChange(value)
    const city = allCities.find((item) => item.code === value)
    if (city && withCoordinates) {
      setValue("latitude", String(city.latitude), { shouldValidate: true })
      setValue("longitude", String(city.longitude), { shouldValidate: true })
    }
    setOpen(false)
    setSearch("")
  }
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState("")
  function locate() {
    if (!navigator.geolocation) {
      setLocationError("Браузер не поддерживает определение местоположения.")
      return
    }
    setLocating(true)
    setLocationError("")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        // Approximate distance is enough to pick the nearest dictionary city.
        const scale = Math.cos((coords.latitude * Math.PI) / 180)
        const distance = (city: { latitude: number; longitude: number }) =>
          (city.latitude - coords.latitude) ** 2 +
          ((city.longitude - coords.longitude) * scale) ** 2
        const nearest = allCities.reduce<(typeof allCities)[number] | null>(
          (best, city) =>
            !best || distance(city) < distance(best) ? city : best,
          null,
        )
        if (nearest) choose(nearest.code)
        setValue("latitude", coords.latitude.toFixed(6), {
          shouldValidate: true,
          shouldDirty: true,
        })
        setValue("longitude", coords.longitude.toFixed(6), {
          shouldValidate: true,
          shouldDirty: true,
        })
      },
      (error) => {
        setLocating(false)
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Нет доступа к местоположению. Разрешите его в настройках браузера или выберите город вручную."
            : "Не удалось определить местоположение. Выберите город вручную.",
        )
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }
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
      <Field data-invalid={!!fieldState.error}>
        <FieldLabel htmlFor="cityCode">Город</FieldLabel>
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value)
            setSearch("")
          }}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              id="cityCode"
              role="combobox"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-invalid={!!fieldState.error}
              aria-describedby="cityCode-error"
              ref={(node) => field.ref(node)}
              onBlur={() => field.onBlur()}
              disabled={!cities.data || isSubmitting}
              className="h-12 w-full justify-between rounded-xl border-primary/25 bg-primary/[0.03] px-4 text-base font-normal shadow-xs hover:border-primary/45 hover:bg-primary/[0.03] aria-invalid:border-destructive"
            >
              <MapPin data-icon="inline-start" />
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedCity
                  ? getDictionaryName([selectedCity], selected, locale)
                  : selected === "__none"
                    ? "Город не указан"
                    : selected || "Выберите город"}
              </span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[80dvh] flex-col sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Выберите город</DialogTitle>
              <DialogDescription>
                Начните вводить название, чтобы быстро найти свой город.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="city-search" className="sr-only">
                Поиск города
              </FieldLabel>
              <Input
                id="city-search"
                inputMode="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название города"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault()
                }}
              />
            </Field>
            <div
              className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain"
              aria-label="Города"
            >
              {optional && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => choose("__none")}
                  className="min-h-11 shrink-0 justify-between"
                >
                  Город не указан
                  {selected === "__none" && <Check data-icon="inline-end" />}
                </Button>
              )}
              {groups.map((group) => (
                <section
                  key={group.region}
                  aria-label={getDictionaryName(
                    [group.center],
                    group.center.code,
                    locale,
                  )}
                  className="flex flex-col gap-1"
                >
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                    {getDictionaryName(
                      [group.center],
                      group.center.code,
                      locale,
                    )}
                  </p>
                  {group.cities.map((city) => (
                    <Button
                      key={city.code}
                      type="button"
                      variant={selected === city.code ? "secondary" : "ghost"}
                      className="min-h-11 shrink-0 justify-between"
                      onClick={() => choose(city.code)}
                      aria-pressed={selected === city.code}
                    >
                      <span className="truncate">
                        {getDictionaryName([city], city.code, locale)}
                      </span>
                      {selected === city.code && (
                        <Check data-icon="inline-end" />
                      )}
                    </Button>
                  ))}
                </section>
              ))}
              {groups.length === 0 && (
                <FieldDescription role="status" className="p-3">
                  По этому запросу города не найдены.
                </FieldDescription>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <FieldError id="cityCode-error">{fieldState.error?.message}</FieldError>
      </Field>
      {withCoordinates && (
        <div className="flex flex-col gap-2">
          <LoadingButton
            type="button"
            variant="outline"
            loading={locating}
            loadingText="Определяем местоположение…"
            disabled={!cities.data || isSubmitting}
            onClick={locate}
          >
            <LocateFixed data-icon="inline-start" />
            Взять текущее местоположение
          </LoadingButton>
          <FormAlert message={locationError} />
        </div>
      )}
      {withCoordinates && (
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
      )}
    </div>
  )
}
