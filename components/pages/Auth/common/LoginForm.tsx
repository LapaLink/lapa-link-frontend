"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useLogin, useCooldown } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { AuthFormField, FormAlert } from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import { loginSchema, type LoginValues } from "../schemas"
import { setFormError } from "../lib/setFormError"
import { useAuthRedirect } from "../hooks/useAuthRedirect"

export function LoginForm() {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const login = useLogin()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  useAuthRedirect()
  const busy = form.formState.isSubmitting || login.isPending

  async function submit(values: LoginValues) {
    if (wait > 0) return
    form.clearErrors()
    try {
      await login.mutateAsync(values)
      router.replace(ROUTES.HOME)
    } catch (error) {
      setFormError(form, error)
      if (error instanceof ApiError) {
        if (error.retryAfterSeconds) startCooldown(error.retryAfterSeconds)
        if (error.code === "EMAIL_NOT_VERIFIED") {
          sessionStorage.setItem("lapalink.unverified-email", values.email)
          router.push(ROUTES.REGISTER)
        }
      }
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
        <FormAlert message={form.formState.errors.root?.message} />
        <FieldGroup>
          <AuthFormField
            name="email"
            label="Электронная почта"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            disabled={busy}
            required
          />
          <AuthFormField
            name="password"
            label="Пароль"
            type="password"
            autoComplete="current-password"
            placeholder="Введите пароль"
            disabled={busy}
            required
          />
        </FieldGroup>
        <Button type="submit" size="lg" disabled={busy || wait > 0}>
          {busy
            ? "Входим…"
            : wait > 0
              ? `Попробовать через ${wait} с`
              : "Войти"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link
            href={ROUTES.REGISTER}
            className="font-semibold text-primary hover:underline"
          >
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </FormProvider>
  )
}
