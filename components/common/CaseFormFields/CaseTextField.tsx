"use client"

import { useFormContext } from "react-hook-form"
import { Field, FieldLabel, FieldError, Textarea } from "@/components/ui"

export function CaseTextField({
  name,
  label,
  placeholder,
  maxLength,
}: {
  name: "description" | "condition"
  label: string
  placeholder: string
  maxLength: number
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext()
  const error = errors[name]
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        {...register(name)}
        id={name}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={`${name}-error`}
        rows={name === "description" ? 4 : 3}
      />
      <FieldError id={`${name}-error`}>
        {typeof error?.message === "string" ? error.message : undefined}
      </FieldError>
    </Field>
  )
}
