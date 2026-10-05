"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useLogin, useCooldown } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import { FieldGroup } from "@/components/ui"
import { loginSchema, type LoginValues } from "../schemas"
import { setFormError } from "@/lib/forms"
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
    <Form form={form} onSubmit={submit} busy={busy}>
      <FormAlert message={form.formState.errors.root?.message} />
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
