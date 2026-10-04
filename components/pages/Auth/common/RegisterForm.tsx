"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useRegister, useCooldown } from "@/hooks"
import { savePendingVerification } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { AuthFormField, FormAlert } from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import { registerSchema, type RegisterValues } from "../schemas"
import { setFormError } from "../lib/setFormError"
import { useAuthRedirect } from "../hooks/useAuthRedirect"

export function RegisterForm() {
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  })
  const register = useRegister()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const [notice, setNotice] = useState("")
  const busy = form.formState.isSubmitting || register.isPending
  useAuthRedirect()
  useEffect(() => {
    const timer = setTimeout(() => {
      const email = sessionStorage.getItem("lapalink.unverified-email")
      if (email) {
        form.setValue("email", email)
        setNotice(
          "Эта почта ещё не подтверждена. Заполните форму, и мы пришлём новый код.",
        )
        sessionStorage.removeItem("lapalink.unverified-email")
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [form])

  async function submit(values: RegisterValues) {
    if (wait > 0) return
    form.clearErrors()
    try {
      savePendingVerification(await register.mutateAsync(values), values.email)
      router.push(ROUTES.VERIFY_EMAIL)
    } catch (error) {
      setFormError(form, error)
      if (
        error instanceof ApiError &&
        (error.retryAfterSeconds || error.code === "OTP_RESEND_TOO_OFTEN")
      )
        startCooldown(error.retryAfterSeconds || 60)
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(submit)}
        noValidate
        aria-busy={busy}
        className="flex flex-col gap-6"
      >
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        <FormAlert message={form.formState.errors.root?.message} />
        <FieldGroup>
          <AuthFormField
            name="displayName"
            label="Ваше имя"
            autoComplete="name"
            placeholder="Как к вам обращаться?"
            maxLength={100}
            disabled={busy}
            required
          />
          <AuthFormField
            name="email"
            label="Электронная почта"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            maxLength={320}
            disabled={busy}
            required
          />
          <AuthFormField
            name="password"
            label="Пароль"
            type="password"
            autoComplete="new-password"
            placeholder="Придумайте пароль"
            description="Не менее 8 символов."
            disabled={busy}
            required
          />
        </FieldGroup>
        <Button type="submit" size="lg" disabled={busy || wait > 0}>
          {busy
            ? "Создаём аккаунт…"
            : wait > 0
              ? `Попробовать через ${wait} с`
              : "Создать аккаунт"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link
            href={ROUTES.LOGIN}
            className="font-semibold text-primary hover:underline"
          >
            Войти
          </Link>
        </p>
      </form>
    </FormProvider>
  )
}
