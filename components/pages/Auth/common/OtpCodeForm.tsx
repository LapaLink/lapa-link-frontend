"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useConfirmOtp, useCooldown, useCountdown } from "@/hooks"
import type { PendingOtp } from "@/lib/auth"
import {
  Form,
  FormAlert,
  Loader,
  LoadingButton,
  OtpCodeField,
  ResendCodeButton,
} from "@/components/common"
import { FieldGroup } from "@/components/ui"
import { verificationSchema, type VerificationValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { getOtpFlowErrorAction } from "../otpFlowErrors"
import { GENERIC_ERROR, confirmOtpCode, openOtpCodeStep } from "../otpFlow"
import { passwordResetFlow } from "../passwordResetFlow"
import { registrationFlow } from "../registrationFlow"

// Pages are server components, so they pick a flow by name, not by config object.
const FLOWS = {
  registration: registrationFlow,
  "password-reset": passwordResetFlow,
}

/** The code screen shared by registration and password reset. */
export function OtpCodeForm({ flow: flowName }: { flow: keyof typeof FLOWS }) {
  const flow = FLOWS[flowName]
  const form = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: "" },
  })
  // `exhausted` keeps the email for a resend after the burnt requestId is dropped.
  const [pending, setPending] = useState<
    (PendingOtp & { exhausted?: boolean }) | null
  >(null)
  const [locked, setLocked] = useState(false)
  const [notice, setNotice] = useState("")
  const confirm = useConfirmOtp()
  const resend = useMutation({ mutationFn: flow.requestCode })
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const expires = useCountdown(pending?.expiresAt || 0)
  const resendWait = useCountdown(pending?.resendAt || 0)
  const busy =
    form.formState.isSubmitting || confirm.isPending || resend.isPending
  useAuthRedirect()

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = openOtpCodeStep(flow)
      if ("redirect" in step) router.replace(step.redirect)
      else setPending(step.pending)
    }, 0)
    return () => clearTimeout(timer)
  }, [flow, router])

  function update(next: PendingOtp) {
    flow.storage.updatePending(next)
    setPending(next)
  }

  async function submit({ code }: VerificationValues) {
    if (!pending || pending.exhausted || locked || wait > 0) return
    if (confirm.isPending) return
    form.clearErrors()
    setNotice("")
    const result = await confirmOtpCode(flow, pending, code, confirm.mutateAsync)
    if ("redirect" in result) {
      if (result.toast) toast.error(result.toast)
      router.replace(result.redirect)
      return
    }
    const { action, error } = result
    const message = error instanceof Error ? error.message : GENERIC_ERROR
    const retryAfter =
      error instanceof ApiError ? error.retryAfterSeconds : undefined
    switch (action) {
      case "invalid-code":
        form.resetField("code")
        form.setError("code", { type: "server", message }, { shouldFocus: true })
        return
      case "expired":
        form.setError("root", { message: `${message} Отправьте код повторно.` })
        return
      case "exhausted":
        setPending({ ...pending, exhausted: true })
        form.setError("root", { message })
        return
      case "locked":
        setLocked(true)
        form.setError("root", { message })
        return
      case "throttled":
        startCooldown(retryAfter || 60)
        form.setError("root", { message })
        return
      case "in-progress":
        return
      case "unknown":
        toast.error(GENERIC_ERROR)
        return
      default:
        setFormError(form, error)
    }
  }

  async function resendCode() {
    if (!pending || resendWait > 0 || locked || busy) return
    form.clearErrors()
    setNotice("")
    try {
      const response = await resend.mutateAsync(pending.email)
      setPending(flow.storage.savePending(response, pending.email))
      form.resetField("code")
      setNotice("Отправили новый код. Предыдущий больше не действует.")
    } catch (error) {
      const action = getOtpFlowErrorAction(error)
      if (action === "unknown") {
        toast.error(GENERIC_ERROR)
        return
      }
      setFormError(form, error)
      const retryAfter =
        error instanceof ApiError ? error.retryAfterSeconds : undefined
      if (action === "locked") setLocked(true)
      if (action === "throttled" || action === "in-progress") {
        const seconds = retryAfter || (action === "throttled" ? 60 : 3)
        const next = { ...pending, resendAt: Date.now() + seconds * 1000 }
        if (pending.exhausted) setPending(next)
        else update(next)
      }
    }
  }

  if (!pending)
    return (
      <Loader
        label="Подготавливаем форму…"
        className="py-8 text-muted-foreground"
      />
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
        {flowName === "registration" ? (
          <>
            Мы отправили код на{" "}
            <strong className="text-foreground">{pending.email}</strong>.
          </>
        ) : (
          <>
            Если аккаунт с почтой{" "}
            <strong className="text-foreground">{pending.email}</strong>{" "}
            существует, мы отправили на неё код.
          </>
        )}{" "}
        Если письма нет во входящих, загляните в «Спам».
      </p>
      <FormAlert message={form.formState.errors.root?.message} />
      <p role="status" aria-live="polite" className="text-sm empty:hidden">
        {notice}
      </p>
      <FieldGroup>
        <OtpCodeField
          disabled={busy || locked}
          describedBy="code-expiry"
          autoComplete="one-time-code"
          autoFocus
        />
      </FieldGroup>
      <p
        id="code-expiry"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {pending.exhausted
          ? "Слишком много неверных попыток. Запросите новый код."
          : expires > 0
            ? `Код действителен ещё ${expires} с.`
            : "Код истёк, запросите новый."}
      </p>
      <LoadingButton
        type="submit"
        size="lg"
        loading={confirm.isPending}
        loadingText="Проверяем код…"
        disabled={busy || locked || wait > 0 || !!pending.exhausted}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Подтвердить"}
      </LoadingButton>
      <ResendCodeButton
        size="default"
        wait={resendWait}
        loading={resend.isPending}
        disabled={busy || locked}
        onClick={() => void resendCode()}
      />
      <Link
        href={flow.routes.start}
        onClick={() => {
          flow.storage.setEmail(pending.email)
          flow.storage.clearPending()
        }}
        className="text-center text-sm text-primary hover:underline"
      >
        Изменить email
      </Link>
    </Form>
  )
}
