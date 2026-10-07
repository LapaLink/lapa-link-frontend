"use client"

import type { ReactNode } from "react"
import { useController, useFormContext } from "react-hook-form"
import {
  Field,
  FieldLabel,
  FieldError,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/components/ui"

export function CaseSelectField({
  name,
  label,
  placeholder,
  children,
  disabled,
  onChange,
}: {
  name: "animalType" | "sex" | "cityCode"
  label: string
  placeholder: string
  children: ReactNode
  disabled?: boolean
  onChange?: (value: string) => void
}) {
  const { control, formState } = useFormContext()
  const { field, fieldState } = useController({ name, control })
  return (
    <Field data-invalid={!!fieldState.error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Select
        value={field.value || ""}
        onValueChange={(value) => {
          field.onChange(value)
          onChange?.(value)
        }}
        disabled={disabled || formState.isSubmitting}
      >
        <SelectTrigger
          id={name}
          ref={(node) => field.ref(node)}
          onBlur={() => field.onBlur()}
          aria-invalid={!!fieldState.error}
          aria-describedby={`${name}-error`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {children}
        </SelectContent>
      </Select>
      <FieldError id={`${name}-error`}>{fieldState.error?.message}</FieldError>
    </Field>
  )
}
