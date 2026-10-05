"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useVerifyEmail, useResendCode, useCountdown } from "@/hooks"
import { savePendingVerification, clearPendingVerification } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import {
  Form,
  FormAlert,
  Loader,
  LoadingButton,
  OtpCodeField,
  ResendCodeButton,
} from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import { verificationSchema, type VerificationValues } from "../schemas"
import { setFormError } from "@/lib/forms"
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

  if (!isReady)
    return (
      <Loader
        label="Подготавливаем форму…"
        className="py-8 text-muted-foreground"
      />
    )
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
    <Form
      form={form}
      onSubmit={submit}
      busy={busy}
      autoComplete="off"
      className="gap-5"
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
        <OtpCodeField
          disabled={busy || !!codeUnavailable}
          describedBy="code-expiry"
        />
      </FieldGroup>
      <p id="code-expiry" className="text-sm text-muted-foreground">
        {pending.exhausted
          ? "Слишком много неверных попыток. Запросите новый код."
          : expires > 0
            ? `Код действителен ещё ${expires} с.`
            : "Этот код уже не действует. Отправим новый?"}
      </p>
      <LoadingButton
        type="submit"
        size="lg"
        loading={verify.isPending}
        loadingText="Подтверждаем…"
        disabled={busy || !!codeUnavailable}
      >
        Подтвердить почту
      </LoadingButton>
      <ResendCodeButton
        size="default"
        wait={resendWait}
        loading={resend.isPending}
        disabled={busy}
        onClick={() => void resendCode()}
      />
      <Link
        href={ROUTES.REGISTER}
        className="text-center text-sm text-primary hover:underline"
      >
        Указать другую почту
      </Link>
    </Form>
  )
}
