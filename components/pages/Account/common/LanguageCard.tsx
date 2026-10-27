"use client"

import { useState } from "react"
import { getErrorMessage } from "@/api"
import { useUpdateLocale } from "@/hooks"
import { resolveDictionaryLocale } from "@/lib/dictionaries"
import { Globe } from "lucide-react"
import { FormAlert, Loader, SectionCard } from "@/components/common"
import { Button } from "@/components/ui"
import type { CurrentUser, UserLocale } from "@/types"

const languages: Array<{ value: UserLocale; label: string }> = [
  { value: "ru", label: "Русский" },
  { value: "be", label: "Беларуская" },
]

export function LanguageCard({ user }: { user: CurrentUser }) {
  return (
    <SectionCard
      icon={Globe}
      title="Язык"
      description="На этом языке приходят письма, сообщения об ошибках и названия городов."
    >
      <LanguagePicker user={user} />
    </SectionCard>
  )
}

/** Account language as two pill radios; a pick saves at once. */
export function LanguagePicker({ user }: { user: CurrentUser }) {
  const update = useUpdateLocale()
  const [error, setError] = useState("")
  const current = resolveDictionaryLocale(user.locale)

  async function select(locale: UserLocale) {
    if (locale === current || update.isPending) return
    setError("")
    try {
      await update.mutateAsync(locale)
    } catch (mutationError) {
      setError(getErrorMessage(mutationError, "Не удалось сменить язык."))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Язык" className="flex flex-wrap gap-2">
        {languages.map(({ value, label }) => {
          const active = value === current
          return (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              variant={active ? "default" : "outline"}
              className="h-11 min-w-28 rounded-full px-5 sm:h-10"
              disabled={update.isPending}
              onClick={() => void select(value)}
            >
              {update.isPending && update.variables === value ? (
                <Loader label="Сохраняем…" />
              ) : (
                label
              )}
            </Button>
          )
        })}
      </div>
      <FormAlert message={error} />
    </div>
  )
}
