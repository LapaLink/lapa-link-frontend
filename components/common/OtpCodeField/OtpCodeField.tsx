"use client"

import { Controller, useFormContext } from "react-hook-form"
import {
  Field,
  FieldLabel,
  FieldError,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui"

type OtpCodeFieldProps = {
  name?: string
  disabled?: boolean
  describedBy?: string
  autoFocus?: boolean
}

export function OtpCodeField({
  name = "code",
  disabled,
  describedBy,
  autoFocus,
}: OtpCodeFieldProps) {
  const { control } = useFormContext()
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={!!fieldState.error} data-disabled={disabled}>
          <FieldLabel htmlFor={name}>Код из письма</FieldLabel>
          <InputOTP
            {...field}
            id={name}
            maxLength={6}
            inputMode="numeric"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            pushPasswordManagerStrategy="none"
            pasteTransformer={(text) => text.replace(/\D/g, "")}
            aria-invalid={!!fieldState.error}
            aria-describedby={
              [fieldState.error && `${name}-error`, describedBy]
                .filter(Boolean)
                .join(" ") || undefined
            }
            required
            disabled={disabled}
            autoFocus={autoFocus}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  aria-invalid={!!fieldState.error}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <FieldError id={`${name}-error`}>
            {fieldState.error?.message}
          </FieldError>
        </Field>
      )}
    />
  )
}
