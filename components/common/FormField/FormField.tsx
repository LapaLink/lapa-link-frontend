"use client"

import { useFormContext } from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from "@/components/ui"
import type { ComponentProps } from "react"

type FormFieldProps = ComponentProps<typeof Input> & {
  name: string
  label: string
  description?: string
}

export function FormField({
  name,
  label,
  description,
  ...props
}: FormFieldProps) {
  const { register, getFieldState, formState } = useFormContext()
  const { error } = getFieldState(name, formState)
  return (
    <Field data-invalid={!!error} data-disabled={props.disabled}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        {...props}
        {...register(name)}
        id={name}
        aria-invalid={!!error}
        aria-describedby={`${name}-error${description ? ` ${name}-description` : ""}`}
      />
      {description && (
        <FieldDescription id={`${name}-description`}>
          {description}
        </FieldDescription>
      )}
      <FieldError id={`${name}-error`}>{error?.message}</FieldError>
    </Field>
  )
}
