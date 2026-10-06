"use client"

import { useFormContext, useWatch } from "react-hook-form"
import { useNeedTypes } from "@/hooks"
import { getDictionaryName } from "@/lib/dictionaries"
import { FormAlert, Loader } from "@/components/common"
import {
  Button,
  Checkbox,
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui"
import type { DictionaryLocale } from "@/types"
import type { CreateCaseValues } from "../schemas"

export function NeedTypesField({ locale }: { locale: DictionaryLocale }) {
  const types = useNeedTypes()
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<CreateCaseValues>()
  const selected = useWatch({ control, name: "needTypes" })
  return (
    <FieldSet>
      <FieldLegend>Какая помощь нужна?</FieldLegend>
      <FieldDescription>
        Выберите один или несколько вариантов. Если пока не знаете, можно ничего
        не выбирать.
      </FieldDescription>
      {types.isPending && <Loader label="Загружаем виды помощи…" />}
      {types.isError && (
        <div className="flex flex-col gap-3">
          <FormAlert message={types.error.message} />
          <Button
            type="button"
            variant="outline"
            onClick={() => void types.refetch()}
          >
            Загрузить виды помощи ещё раз
          </Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {types.data
          ?.filter((type) => type.active)
          .map((type) => (
            <Field
              key={type.code}
              orientation="horizontal"
              className="min-h-14 rounded-xl border border-primary/20 bg-primary/[0.02] p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:shadow-xs hover:border-primary/50"
            >
              <Checkbox
                id={`need-${type.code}`}
                checked={selected.includes(type.code)}
                onCheckedChange={(checked) =>
                  setValue(
                    "needTypes",
                    checked
                      ? [...selected, type.code]
                      : selected.filter((code) => code !== type.code),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              />
              <FieldLabel
                htmlFor={`need-${type.code}`}
                className="cursor-pointer"
              >
                {getDictionaryName([type], type.code, locale)}
              </FieldLabel>
            </Field>
          ))}
      </div>
      {types.data?.length === 0 && (
        <FieldDescription>Сейчас нет доступных видов помощи.</FieldDescription>
      )}
      <FieldError>{errors.needTypes?.message}</FieldError>
    </FieldSet>
  )
}
