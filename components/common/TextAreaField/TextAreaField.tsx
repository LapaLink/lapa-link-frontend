"use client"

import { useFormContext, useWatch } from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from "@/components/ui"

/** Optional free-text field with a live "used / max" character counter. */
export function TextAreaField({
  name,
  label,
  placeholder,
  maxLength,
  disabled,
  required,
}: {
  name: string
  label: string
  placeholder?: string
  maxLength: number
  disabled?: boolean
  required?: boolean
}) {
  const { register, control, getFieldState, formState } = useFormContext()
  const value: string = useWatch({ control, name }) ?? ""
  const { error } = getFieldState(name, formState)
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        {...register(name)}
        id={name}
        rows={3}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={`${name}-error ${name}-counter`}
      />
      <FieldDescription id={`${name}-counter`} className="text-right">
        {value.length} / {maxLength}
      </FieldDescription>
      <FieldError id={`${name}-error`}>{error?.message}</FieldError>
    </Field>
  )
}
