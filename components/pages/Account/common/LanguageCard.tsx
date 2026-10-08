"use client"

import { useState } from "react"
import { getErrorMessage } from "@/api"
import { useUpdateLocale } from "@/hooks"
import { resolveDictionaryLocale } from "@/lib/dictionaries"
import { FormAlert, Loader } from "@/components/common"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui"
import type { CurrentUser, UserLocale } from "@/types"

const languages: Array<{ value: UserLocale; label: string }> = [
  { value: "ru", label: "Русский" },
  { value: "be", label: "Беларуская" },
]

export function LanguageCard({ user }: { user: CurrentUser }) {
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Язык</h2>
        </CardTitle>
        <CardDescription>
          На этом языке приходят письма, сообщения об ошибках и названия
          городов.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
      </CardContent>
    </Card>
  )
}
