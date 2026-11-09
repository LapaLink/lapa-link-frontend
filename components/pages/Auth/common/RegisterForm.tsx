"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useRegister, useCooldown } from "@/hooks"
import { registrationStorage, setPasswordResetEmail } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import {
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui"
import { registerSchema, type RegisterValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { GENERIC_ERROR, requestOtpCode } from "../otpFlow"
import { registrationFlow } from "../registrationFlow"

export function RegisterForm() {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", consentAccepted: false },
  })
  const register = useRegister()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const [locked, setLocked] = useState(false)
  const [existingEmail, setExistingEmail] = useState("")
  const busy = form.formState.isSubmitting || register.isPending
  const consented = useWatch({ control: form.control, name: "consentAccepted" })
  useAuthRedirect()
  useEffect(() => {
    const timer = setTimeout(() => {
      const email =
        registrationStorage.takeEmail() ||
        registrationStorage.readPending()?.email
      if (email) form.setValue("email", email)
    }, 0)
    return () => clearTimeout(timer)
  }, [form])

  async function submit({ email, consentAccepted }: RegisterValues) {
    if (wait > 0 || locked || register.isPending) return
    form.clearErrors()
    setExistingEmail("")
    const result = await requestOtpCode(registrationFlow, email, (value) =>
      register.mutateAsync({ email: value, consentAccepted }),
    )
    if ("redirect" in result) {
      router.push(result.redirect)
      return
    }
    const { action, error } = result
    switch (action) {
      case "already-exists":
        setExistingEmail(email)
        return
      case "in-progress":
        return
      case "unknown":
        toast.error(GENERIC_ERROR)
        return
    }
    setFormError(form, error)
    // The only field the user can get wrong after the email format check is
    // the consent: show the server text at the checkbox, not above the form.
    if (
      error instanceof ApiError &&
      error.code === "VALIDATION_FAILED" &&
      !form.getFieldState("consentAccepted").error &&
      !form.getFieldState("email").error
    ) {
      form.clearErrors("root")
      form.setError("consentAccepted", { message: error.message })
    }
    if (action === "locked") setLocked(true)
    if (action === "throttled") startCooldown(retryDelay(error, email))
  }

  return (
    <Form form={form} onSubmit={submit} busy={busy}>
      <FormAlert message={form.formState.errors.root?.message} />
      {existingEmail && (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p>Аккаунт с этим email уже есть.</p>
          <p className="flex gap-4">
            <Link
              href={ROUTES.LOGIN}
              className="font-semibold text-primary hover:underline"
            >
              Войти
            </Link>
            <Link
              href={ROUTES.FORGOT_PASSWORD}
              onClick={() => setPasswordResetEmail(existingEmail)}
              className="font-semibold text-primary hover:underline"
            >
              Забыли пароль?
            </Link>
          </p>
        </div>
      )}
      <FieldGroup>
        <FormField
          name="email"
          label="Электронная почта"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          maxLength={320}
          disabled={busy || locked}
          required
        />
        <Controller
          name="consentAccepted"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field
              orientation="horizontal"
              data-invalid={!!fieldState.error}
              data-disabled={busy || locked}
            >
              <Checkbox
                id="consentAccepted"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={busy || locked}
                aria-invalid={!!fieldState.error}
                aria-describedby="consentAccepted-error"
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="consentAccepted" className="font-normal">
                  <span>
                    Я принимаю{" "}
                    <Link
                      href={ROUTES.TERMS}
                      target="_blank"
                      className="font-semibold text-primary hover:underline"
                    >
                      пользовательское соглашение
                    </Link>{" "}
                    и{" "}
                    <Link
                      href={ROUTES.PRIVACY}
                      target="_blank"
                      className="font-semibold text-primary hover:underline"
                    >
                      политику
                    </Link>{" "}
                    обработки персональных данных
                  </span>
                </FieldLabel>
                <FieldError id="consentAccepted-error">
                  {fieldState.error?.message}
                </FieldError>
              </div>
            </Field>
          )}
        />
      </FieldGroup>
      <LoadingButton
        type="submit"
        size="lg"
        loading={busy}
        loadingText="Отправляем код…"
        disabled={wait > 0 || locked || !consented}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Получить код"}
      </LoadingButton>
      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link
          href={ROUTES.LOGIN}
          className="font-semibold text-primary hover:underline"
        >
          Войти
        </Link>
      </p>
    </Form>
  )
}

// Retry-After comes only with RATE_LIMITED/IP_BLOCKED; OTP_RESEND_TOO_OFTEN
// waits for the last known resend timer of this email, or a minute.
function retryDelay(error: unknown, email: string) {
  if (error instanceof ApiError && error.retryAfterSeconds)
    return error.retryAfterSeconds
  const pending = registrationStorage.readPending()
  const left =
    pending?.email === email
      ? Math.ceil((pending.resendAt - Date.now()) / 1000)
      : 0
  return left > 0 ? left : 60
}
