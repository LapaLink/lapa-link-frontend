"use client"

import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import type { AnimalCase, DictionaryLocale, NeedType, CityGroup } from "@/types"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"
import { FormAlert, LoadingButton } from "@/components/common"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui"

export function PublicationResult({
  animalCase,
  cities,
  types,
  locale,
  pendingTypes,
  finished,
  busy,
  error,
  onRetry,
  onCreateAnother,
  onSkipType,
}: {
  animalCase: AnimalCase
  cities?: CityGroup[]
  types?: NeedType[]
  locale: DictionaryLocale
  pendingTypes: string[]
  finished: boolean
  busy: boolean
  error: string
  onRetry: () => void
  onCreateAnother: () => void
  onSkipType: (type: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CheckCircle2 className="size-8 text-primary" aria-hidden />
        <CardTitle>
          <h1>{finished ? "Объявление опубликовано" : "Объявление создано"}</h1>
        </CardTitle>
        <CardDescription>
          {finished
            ? "Спасибо, что помогаете животным. Данные сохранены."
            : "Само объявление уже сохранено. Осталось добавить выбранные виды помощи."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="break-words text-xl font-semibold">{animalCase.title}</p>
        <p className="text-muted-foreground">
          {animalCase.animalType === "CAT" ? "Кошка" : "Собака"} ·{" "}
          {getCityName(cities, animalCase.cityCode, locale)}
        </p>
        {!finished && (
          <>
            <p className="text-sm">
              Ещё не добавлено:{" "}
              {pendingTypes
                .map((code) => getDictionaryName(types, code, locale))
                .join(", ")}
              .
            </p>
            <FormAlert message={error} />
            {types &&
              pendingTypes
                .filter(
                  (code) =>
                    !types.some((type) => type.code === code && type.active),
                )
                .map((code) => (
                  <div key={code} className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Этот вид помощи больше недоступен: {code}.
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onSkipType(code)}
                    >
                      Продолжить без этого вида помощи
                    </Button>
                  </div>
                ))}
            <LoadingButton
              loading={busy}
              loadingText="Добавляем помощь…"
              size="lg"
              onClick={onRetry}
            >
              Повторить добавление помощи
            </LoadingButton>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row">
        {finished && (
          <Button size="lg" onClick={onCreateAnother}>
            Создать ещё объявление
          </Button>
        )}
        <Button variant="outline" size="lg" asChild>
          <Link href={ROUTES.HOME}>На главную</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
