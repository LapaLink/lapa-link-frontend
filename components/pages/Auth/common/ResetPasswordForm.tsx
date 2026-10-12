"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/api"
import {
  useCooldown,
  useCountdown,
  useForgotPassword,
  useResetPassword,
} from "@/hooks"
import {
  clearPendingPasswordReset,
  markPasswordResetDone,
  readPendingPasswordReset,
  savePendingPasswordReset,
  updatePendingPasswordReset,
  type PendingPasswordReset,
} from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import {
  Form,
  FormAlert,
  FormField,
  Loader,
  LoadingButton,
  OtpCodeField,
  ResendCodeButton,
} from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { getPasswordResetErrorAction } from "../passwordResetErrors"

const GENERIC_ERROR = "Что-то пошло не так, попробуйте позже."

export function ResetPasswordForm() {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  })
  // `exhausted` keeps the email for a resend after the burnt requestId is dropped.
  const [pending, setPending] = useState<
    (PendingPasswordReset & { exhausted?: boolean }) | null
  >(null)
  const [isReady, setIsReady] = useState(false)
  const [locked, setLocked] = useState(false)
  const [notice, setNotice] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const reset = useResetPassword()
  const resend = useForgotPassword()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const expires = useCountdown(pending?.expiresAt || 0)
  const resendWait = useCountdown(pending?.resendAt || 0)
  const busy = form.formState.isSubmitting || reset.isPending || resend.isPending
  const submitBlocked = locked || wait > 0 || !!pending?.exhausted
  useAuthRedirect()

  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = readPendingPasswordReset()
      if (!stored) router.replace(ROUTES.FORGOT_PASSWORD)
      setPending(stored)
      setIsReady(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [router])

  function update(next: PendingPasswordReset) {
    updatePendingPasswordReset(next)
    setPending(next)
  }

  async function submit({ code, newPassword }: ResetPasswordValues) {
    if (!pending || submitBlocked || reset.isPending) return
    form.clearErrors()
    setNotice("")
    try {
      await reset.mutateAsync({
        requestId: pending.requestId,
        code,
        newPassword,
      })
      clearPendingPasswordReset()
      markPasswordResetDone()
      router.replace(ROUTES.LOGIN)
    } catch (error) {
      const action = getPasswordResetErrorAction(error)
      const message = error instanceof Error ? error.message : GENERIC_ERROR
      const retryAfter =
        error instanceof ApiError ? error.retryAfterSeconds : undefined
      switch (action) {
        case "invalid-code":
          form.resetField("code")
          form.setError(
            "code",
            { type: "server", message },
            { shouldFocus: true },
          )
          return
        case "expired":
          form.setError("root", {
            message: `${message} Отправьте код повторно.`,
          })
          return
        case "exhausted":
          clearPendingPasswordReset()
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
          setNotice("Уже меняем пароль, подождите немного…")
          return
        case "unknown":
          toast.error(GENERIC_ERROR)
          return
        default:
          setFormError(form, error)
      }
    }
  }

  async function resendCode() {
    if (!pending || resendWait > 0 || locked || busy) return
    form.clearErrors()
    setNotice("")
    try {
      const response = await resend.mutateAsync(pending.email)
      setPending(savePendingPasswordReset(response, pending.email))
      form.resetField("code")
      setNotice("Отправили новый код. Предыдущий больше не действует.")
    } catch (error) {
      const action = getPasswordResetErrorAction(error)
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

  if (!isReady || !pending)
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
        Если аккаунт с почтой{" "}
        <strong className="text-foreground">{pending.email}</strong> существует,
        мы отправили на неё код. Если письма нет во входящих, загляните в
        «Спам».
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
        />
        <p
          id="code-expiry"
          aria-live="polite"
          className="-mt-3 text-sm text-muted-foreground"
        >
          {pending.exhausted
            ? "Слишком много неверных попыток. Запросите новый код."
            : expires > 0
              ? `Код действителен ещё ${expires} с.`
              : "Код истёк, запросите новый."}
        </p>
        <FormField
          name="newPassword"
          label="Новый пароль"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Придумайте новый пароль"
          description="Не менее 8 символов."
          disabled={busy || locked}
          required
        />
        <FormField
          name="confirmPassword"
          label="Повторите пароль"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Введите пароль ещё раз"
          disabled={busy || locked}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          aria-pressed={showPassword}
          aria-controls="newPassword confirmPassword"
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showPassword ? "Скрыть пароль" : "Показать пароль"}
        </Button>
      </FieldGroup>
      <LoadingButton
        type="submit"
        size="lg"
        loading={reset.isPending}
        loadingText="Меняем пароль…"
        disabled={busy || submitBlocked}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Сменить пароль"}
      </LoadingButton>
      <ResendCodeButton
        size="default"
        wait={resendWait}
        loading={resend.isPending}
        disabled={busy || locked}
        onClick={() => void resendCode()}
      />
      <Link
        href={ROUTES.FORGOT_PASSWORD}
        className="text-center text-sm text-primary hover:underline"
      >
        Изменить email
      </Link>
    </Form>
  )
}
