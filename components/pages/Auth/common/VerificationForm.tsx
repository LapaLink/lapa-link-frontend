"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useVerifyEmail, useResendCode, useCountdown } from "@/hooks"
import { savePendingVerification, clearPendingVerification } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { FormAlert } from "@/components/common"
import {
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui"
import { verificationSchema, type VerificationValues } from "../schemas"
import { setFormError } from "../lib/setFormError"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { usePendingVerification } from "../hooks/usePendingVerification"

export function VerificationForm() {
  const form = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: "" },
  })
  const { pending, isReady, update } = usePendingVerification()
  const verify = useVerifyEmail()
  const resend = useResendCode()
  const router = useRouter()
  const [notice, setNotice] = useState("")
  const expires = useCountdown(pending?.expiresAt || 0)
  const resendWait = useCountdown(pending?.resendAt || 0)
  const busy =
    form.formState.isSubmitting || verify.isPending || resend.isPending
  const codeUnavailable = pending?.exhausted || expires === 0
  useAuthRedirect()

  async function submit({ code }: VerificationValues) {
    if (!pending || codeUnavailable) return
    form.clearErrors()
    try {
      await verify.mutateAsync({
        userId: pending.userId,
        requestId: pending.requestId,
        code,
      })
      clearPendingVerification()
      router.replace(ROUTES.HOME)
    } catch (error) {
      setFormError(form, error)
      if (error instanceof ApiError && error.code === "OTP_ATTEMPTS_EXCEEDED")
        update({ ...pending, exhausted: true })
    }
  }

  async function resendCode() {
    if (!pending || resendWait > 0 || busy) return
    form.clearErrors()
    setNotice("")
    try {
      const response = await resend.mutateAsync(pending.userId)
      update(savePendingVerification(response, pending.email))
      form.reset()
      setNotice("Отправили новое письмо. Введите код из него.")
    } catch (error) {
      setFormError(form, error)
      if (
        error instanceof ApiError &&
        (error.retryAfterSeconds || error.code === "OTP_RESEND_TOO_OFTEN")
      )
        update({
          ...pending,
          resendAt: Date.now() + (error.retryAfterSeconds || 60) * 1000,
        })
    }
  }

  if (!isReady) return <p role="status">Подготавливаем форму…</p>
  if (!pending)
    return (
      <div className="flex flex-col gap-4">
        <p>Сначала укажите вашу почту, и мы отправим код подтверждения.</p>
        <Button asChild>
          <Link href={ROUTES.REGISTER}>К регистрации</Link>
        </Button>
      </div>
    )

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(submit)}
        noValidate
        autoComplete="off"
        aria-busy={busy}
        className="flex flex-col gap-5"
      >
        <p className="break-words text-sm text-muted-foreground">
          Письмо отправлено на{" "}
          <strong className="text-foreground">{pending.email}</strong>. Если его
          нет во входящих, загляните в «Спам».
        </p>
        <FormAlert message={form.formState.errors.root?.message} />
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        <FieldGroup>
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                data-invalid={!!fieldState.error}
                data-disabled={busy || !!codeUnavailable}
              >
                <FieldLabel htmlFor="code">Код из письма</FieldLabel>
                <InputOTP
                  {...field}
                  id="code"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  pushPasswordManagerStrategy="none"
                  pasteTransformer={(text) => text.replace(/\D/g, "")}
                  aria-invalid={!!fieldState.error}
                  aria-describedby="code-error code-expiry"
                  required
                  disabled={busy || !!codeUnavailable}
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
                <FieldError id="code-error">
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )}
          />
        </FieldGroup>
        <p id="code-expiry" className="text-sm text-muted-foreground">
          {pending.exhausted
            ? "Слишком много неверных попыток. Запросите новый код."
            : expires > 0
              ? `Код действителен ещё ${expires} с.`
              : "Этот код уже не действует. Отправим новый?"}
        </p>
        <Button type="submit" size="lg" disabled={busy || !!codeUnavailable}>
          {verify.isPending ? "Подтверждаем…" : "Подтвердить почту"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || resendWait > 0}
          onClick={() => void resendCode()}
        >
          {resend.isPending
            ? "Отправляем…"
            : resendWait > 0
              ? `Отправить ещё раз через ${resendWait} с`
              : "Отправить код ещё раз"}
        </Button>
        <Link
          href={ROUTES.REGISTER}
          className="text-center text-sm text-primary hover:underline"
        >
          Указать другую почту
        </Link>
      </form>
    </FormProvider>
  )
}
