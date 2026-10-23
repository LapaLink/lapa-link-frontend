"use client"

import Link from "next/link"
import { CheckCircle2, MapPin, PawPrint } from "lucide-react"
import type { AnimalCase, DictionaryLocale, NeedType, CityGroup } from "@/types"
import { getCityName, getDictionaryName } from "@/lib/dictionaries"
import { ROUTES } from "@/lib/constants"
import {
  FormAlert,
  IconCircle,
  LoadingButton,
  StatusBadge,
} from "@/components/common"
import { Button, Card, CardContent } from "@/components/ui"

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
  const pendingReview = animalCase.status === "PENDING_REVIEW"
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <IconCircle icon={CheckCircle2} tone={finished ? "success" : "primary"} />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {!finished
              ? "Объявление создано"
              : pendingReview
                ? "Объявление отправлено на проверку"
                : "Объявление опубликовано"}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {!finished
              ? "Само объявление уже сохранено. Осталось добавить выбранные виды помощи."
              : pendingReview
                ? "Модератор проверит объявление, после одобрения оно появится в общем списке. Мы пришлём уведомление."
                : "Спасибо, что помогаете животным. Данные сохранены."}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 rounded-2xl border bg-background/60 p-4">
          <p className="break-words text-lg font-bold [overflow-wrap:anywhere]">
            {animalCase.title}
          </p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="primary" icon={PawPrint}>
              {animalCase.animalType === "CAT" ? "Кошка" : "Собака"}
            </StatusBadge>
            <StatusBadge icon={MapPin}>
              {getCityName(cities, animalCase.cityCode, locale)}
            </StatusBadge>
          </div>
        </div>
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
        <div className="flex flex-col gap-3 sm:flex-row">
          {finished && (
            <Button size="lg" className="sm:flex-1" onClick={onCreateAnother}>
              Создать ещё объявление
            </Button>
          )}
          <Button variant="outline" size="lg" className="sm:flex-1" asChild>
            <Link href={ROUTES.HOME}>На главную</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
