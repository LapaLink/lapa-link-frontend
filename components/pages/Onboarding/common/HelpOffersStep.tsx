"use client"

import { useState } from "react"
import { cn } from "cn"
import { Check } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, accountApi, getErrorMessage } from "@/api"
import { useDictionaryLocale, useNeedTypes } from "@/hooks"
import { getDictionaryName } from "@/lib/dictionaries"
import { queryKeys } from "@/lib/queryKeys"
import { FormAlert } from "@/components/common"
import { Button, Skeleton, Textarea } from "@/components/ui"
import {
  HELP_OFFER_AVAILABILITY_MAX,
  getAvailableHelpTypes,
  toCreateHelpOfferDto,
} from "../../Account/schemas"
import { StepActions } from "./StepActions"
import type { StepProps } from "./steps"

const DEFAULT_RADIUS_KM = 10

type Draft = { radiusKm: number; availability: string }

/**
 * Need types as chips; each picked one gets a radius and availability.
 * "Далее" creates the help offers; types the user already offers stay checked.
 */
export function HelpOffersStep({ onNext, onBack, onSkip }: StepProps) {
  const client = useQueryClient()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const offers = useQuery({
    queryKey: queryKeys.helpOffers,
    queryFn: ({ signal }) => accountApi.getHelpOffers(signal),
  })
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const typeName = (code: string) =>
    getDictionaryName(needTypes.data, code, locale)
  const offered = new Set(offers.data?.map((offer) => offer.type))
  const available = getAvailableHelpTypes(needTypes.data, offers.data)
  const picked = Object.keys(drafts)

  const toggle = (code: string) =>
    setDrafts((current) => {
      const next = { ...current }
      if (next[code]) delete next[code]
      else next[code] = { radiusKm: DEFAULT_RADIUS_KM, availability: "" }
      return next
    })
  const change = (code: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [code]: { ...current[code], ...patch },
    }))

  async function save() {
    setError("")
    setSaving(true)
    try {
      for (const type of picked) {
        try {
          await accountApi.createHelpOffer(
            toCreateHelpOfferDto({
              type,
              radiusKm: drafts[type].radiusKm,
              availability: drafts[type].availability.trim(),
            }),
          )
        } catch (createError) {
          // Added meanwhile (another tab): nothing left to do for this type.
          if (
            !(createError instanceof ApiError) ||
            createError.code !== "HELP_OFFER_ALREADY_EXISTS"
          )
            throw createError
        }
        setDrafts((current) => {
          const next = { ...current }
          delete next[type]
          return next
        })
      }
      onNext()
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Не удалось сохранить виды помощи."))
    } finally {
      setSaving(false)
      void client.invalidateQueries({ queryKey: queryKeys.helpOffers })
    }
  }

  const loading = needTypes.isPending || offers.isPending
  return (
    <div className="flex flex-col gap-6">
      <fieldset disabled={saving} className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 font-bold">Чем вы готовы помогать?</legend>
        {loading ? (
          <div
            role="status"
            aria-label="Загружаем виды помощи"
            className="flex flex-wrap gap-2"
          >
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-11 w-32 rounded-full" />
            ))}
          </div>
        ) : needTypes.isError || offers.isError ? (
          <div className="flex flex-col items-start gap-3">
            <FormAlert
              message={getErrorMessage(
                needTypes.error ?? offers.error,
                "Не удалось загрузить виды помощи.",
              )}
            />
            <Button
              variant="outline"
              onClick={() => {
                void needTypes.refetch()
                void offers.refetch()
              }}
            >
              Попробовать ещё раз
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[
              ...(offers.data ?? []).map((offer) => offer.type),
              ...available.map((type) => type.code),
            ].map((code) => {
              const done = offered.has(code)
              const selected = done || !!drafts[code]
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={selected}
                  disabled={done}
                  onClick={() => toggle(code)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    selected
                      ? "border-primary bg-primary-soft text-primary-hover"
                      : "border-input bg-card hover:border-primary/40",
                    done && "cursor-default",
                  )}
                >
                  {selected && <Check className="size-4" aria-hidden />}
                  {typeName(code)}
                  {done && (
                    <span className="font-normal text-muted-foreground">
                      · уже добавлено
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </fieldset>

      {picked.map((code) => {
        const draft = drafts[code]
        return (
          <fieldset
            key={code}
            disabled={saving}
            className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
          >
            <legend className="sr-only">{typeName(code)}</legend>
            <p aria-hidden className="font-extrabold">
              {typeName(code)}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`radius-${code}`} className="text-sm font-bold">
                  Радиус
                </label>
                <span className="font-extrabold text-primary">
                  до {draft.radiusKm} км
                </span>
              </div>
              <input
                id={`radius-${code}`}
                type="range"
                min={1}
                max={100}
                step={1}
                value={draft.radiusKm}
                aria-valuetext={`до ${draft.radiusKm} км`}
                onChange={(event) =>
                  change(code, { radiusKm: Number(event.target.value) })
                }
                className="h-7 w-full cursor-pointer accent-primary"
              />
              <p className="text-sm text-muted-foreground">
                От 1 до 100 км от домашней точки — её зададим на следующем шаге.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor={`availability-${code}`}
                className="text-sm font-bold"
              >
                Когда удобно
              </label>
              <Textarea
                id={`availability-${code}`}
                rows={2}
                maxLength={HELP_OFFER_AVAILABILITY_MAX}
                placeholder="Например: будни после 18:00"
                value={draft.availability}
                onChange={(event) =>
                  change(code, { availability: event.target.value })
                }
              />
            </div>
          </fieldset>
        )
      })}

      {!loading && !picked.length && !offered.size && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Выберите хотя бы один вид помощи — или пропустите шаг, если пока не
          готовы.
        </p>
      )}
      <FormAlert message={error} />
      <StepActions
        onBack={onBack}
        onSkip={onSkip}
        onNext={() => void save()}
        busy={saving}
      />
    </div>
  )
}
