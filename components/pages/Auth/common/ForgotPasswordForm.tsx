"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useForgotPassword, useCooldown } from "@/hooks"
import {
  clearPasswordResetConfirmation,
  readPendingPasswordReset,
  savePendingPasswordReset,
  takePasswordResetEmail,
} from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import { FieldGroup } from "@/components/ui"
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { getOtpFlowErrorAction } from "../otpFlowErrors"

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })
  const forgot = useForgotPassword()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const [locked, setLocked] = useState(false)
  const busy = form.formState.isSubmitting || forgot.isPending
  useAuthRedirect()
  useEffect(() => {
    const timer = setTimeout(() => {
      const email =
        takePasswordResetEmail() || readPendingPasswordReset()?.email
      if (email) form.setValue("email", email)
    }, 0)
    return () => clearTimeout(timer)
  }, [form])

  async function submit({ email }: ForgotPasswordValues) {
    if (wait > 0 || locked || forgot.isPending) return
    form.clearErrors()
    try {
      savePendingPasswordReset(await forgot.mutateAsync(email), email)
      clearPasswordResetConfirmation()
      router.push(ROUTES.PASSWORD_RESET_CODE)
    } catch (error) {
      const action = getOtpFlowErrorAction(error)
      if (action === "unknown") {
        toast.error("Что-то пошло не так, попробуйте позже.")
        return
      }
      setFormError(form, error)
      const retryAfter =
        error instanceof ApiError ? error.retryAfterSeconds : undefined
      if (action === "locked") setLocked(true)
      if (action === "throttled") startCooldown(retryAfter || 60)
      if (action === "in-progress") startCooldown(retryAfter || 3)
    }
  }

  return (
    <Form form={form} onSubmit={submit} busy={busy}>
      <FormAlert message={form.formState.errors.root?.message} />
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
      </FieldGroup>
      <LoadingButton
        type="submit"
        size="lg"
        loading={busy}
        loadingText="Отправляем…"
        disabled={wait > 0 || locked}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Отправить код"}
      </LoadingButton>
      <p className="text-center text-sm text-muted-foreground">
        Вспомнили пароль?{" "}
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
