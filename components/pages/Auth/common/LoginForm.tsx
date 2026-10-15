"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useLogin, useCooldown, useRegister } from "@/hooks"
import {
  setPasswordResetEmail,
  takeAccountDeleted,
  takePasswordResetDone,
  takeUserBlocked,
} from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import { FieldGroup } from "@/components/ui"
import { loginSchema, type LoginValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { GENERIC_ERROR, requestOtpCode } from "../otpFlow"
import { registrationFlow } from "../registrationFlow"

export function LoginForm() {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const login = useLogin()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const [notice, setNotice] = useState("")
  // Registration started but not finished: the account has no password yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState("")
  const [continueHint, setContinueHint] = useState("")
  const register = useRegister()
  const { secondsLeft: continueWait, start: startContinueCooldown } =
    useCooldown()
  useAuthRedirect()
  useEffect(() => {
    const timer = setTimeout(() => {
      if (takePasswordResetDone())
        setNotice("Пароль изменён. Войдите с новым паролем.")
      else if (takeAccountDeleted()) setNotice("Аккаунт удалён.")
      else if (takeUserBlocked())
        setNotice("Аккаунт заблокирован. Вы вышли из аккаунта.")
    }, 0)
    return () => clearTimeout(timer)
  }, [])
  const busy = form.formState.isSubmitting || login.isPending

  async function submit(values: LoginValues) {
    if (wait > 0) return
    form.clearErrors()
    setUnverifiedEmail("")
    setContinueHint("")
    try {
      await login.mutateAsync(values)
      router.replace(ROUTES.HOME)
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email)
        return
      }
      setFormError(form, error)
      if (error instanceof ApiError && error.retryAfterSeconds)
        startCooldown(error.retryAfterSeconds)
    }
  }

  async function continueRegistration() {
    if (!unverifiedEmail || register.isPending || continueWait > 0) return
    setContinueHint("")
    const result = await requestOtpCode(
      registrationFlow,
      unverifiedEmail,
      register.mutateAsync,
    )
    if ("redirect" in result) {
      router.push(result.redirect)
      return
    }
    const { action, error } = result
    if (action === "in-progress") return
    if (action === "unknown") {
      toast.error(GENERIC_ERROR)
      return
    }
    const apiError = error instanceof ApiError ? error : null
    if (apiError?.code === "OTP_RESEND_TOO_OFTEN") {
      // The code was sent recently, but this device has no requestId for it.
      setContinueHint("Код уже отправлен недавно, запросите новый через минуту.")
      startContinueCooldown(60)
      return
    }
    setContinueHint(apiError?.message || GENERIC_ERROR)
    if (action === "throttled")
      startContinueCooldown(apiError?.retryAfterSeconds || 60)
  }

  return (
    <Form form={form} onSubmit={submit} busy={busy}>
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      <FormAlert message={form.formState.errors.root?.message} />
      {unverifiedEmail && (
        <div role="alert" className="flex flex-col gap-3 text-sm">
          <p>Регистрация не завершена. Подтвердите email, чтобы продолжить.</p>
          {continueHint && (
            <p className="text-muted-foreground">{continueHint}</p>
          )}
          <LoadingButton
            type="button"
            variant="outline"
            loading={register.isPending}
            loadingText="Отправляем код…"
            disabled={continueWait > 0}
            onClick={() => void continueRegistration()}
          >
            {continueWait > 0
              ? `Отправить код ещё раз через ${continueWait} с`
              : "Продолжить регистрацию"}
          </LoadingButton>
        </div>
      )}
      <FieldGroup>
        <FormField
          name="email"
          label="Электронная почта"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          disabled={busy}
          required
        />
        <FormField
          name="password"
          label="Пароль"
          type="password"
          autoComplete="current-password"
          placeholder="Введите пароль"
          disabled={busy}
          required
        />
      </FieldGroup>
      <Link
        href={ROUTES.FORGOT_PASSWORD}
        onClick={() => setPasswordResetEmail(form.getValues("email").trim())}
        className="-mt-3 self-end text-sm text-primary hover:underline"
      >
        Забыли пароль?
      </Link>
      <LoadingButton
        type="submit"
        size="lg"
        loading={busy}
        loadingText="Входим…"
        disabled={wait > 0}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Войти"}
      </LoadingButton>
      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link
          href={ROUTES.REGISTER}
          className="font-semibold text-primary hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </Form>
  )
}
