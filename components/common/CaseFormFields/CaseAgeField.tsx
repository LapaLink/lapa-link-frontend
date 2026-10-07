"use client"

import { useController, useFormContext } from "react-hook-form"
import { useState } from "react"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui"

export function CaseAgeField() {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({
    control,
    name: "approximateAge",
  })
  const stored = String(field.value ?? "")
  const [selectedUnit, setSelectedUnit] = useState("лет")
  const number = stored.match(/^\d{1,3}/)?.[0] ?? ""
  const unit = stored
    ? stored.includes("месяц")
      ? "месяцев"
      : "лет"
    : selectedUnit
  return (
    <Field data-invalid={!!fieldState.error}>
      <FieldLabel htmlFor="approximateAge">Примерный возраст</FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="approximateAge"
          name="approximateAge"
          ref={(node) => field.ref(node)}
          inputMode="numeric"
          value={number}
          maxLength={3}
          placeholder="Например, 2"
          onBlur={() => field.onBlur()}
          disabled={formState.isSubmitting}
          aria-invalid={!!fieldState.error}
          aria-describedby="age-description age-error"
          onChange={(event) => {
            const value = event.target.value
            if (/^\d{0,3}$/.test(value))
              field.onChange(value ? `${value} ${unit}` : "")
          }}
        />
        <Select
          value={unit}
          onValueChange={(value) => {
            setSelectedUnit(value)
            field.onChange(number ? `${number} ${value}` : "")
          }}
          disabled={formState.isSubmitting}
        >
          <SelectTrigger aria-label="Единица возраста">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="лет">Годы</SelectItem>
              <SelectItem value="месяцев">Месяцы</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <FieldDescription id="age-description">
        Если возраст неизвестен, оставьте поле пустым.
        {stored && !number && ` Ранее указано: ${stored}`}
      </FieldDescription>
      <FieldError id="age-error">{fieldState.error?.message}</FieldError>
    </Field>
  )
}
