"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useCooldown, useResetPassword } from "@/hooks"
import type { PasswordResetConfirmation } from "@/lib/auth"
import {
  Form,
  FormAlert,
  FormField,
  Loader,
  LoadingButton,
} from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import { newPasswordSchema, type NewPasswordValues } from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { GENERIC_ERROR, openConfirmedStep } from "../otpFlow"
import { passwordResetFlow, submitNewPassword } from "../passwordResetFlow"

export function NewPasswordForm() {
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })
  const [confirmation, setConfirmation] =
    useState<PasswordResetConfirmation | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const reset = useResetPassword()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const busy = form.formState.isSubmitting || reset.isPending
  useAuthRedirect()

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = openConfirmedStep(passwordResetFlow)
      if ("redirect" in step) router.replace(step.redirect)
      else setConfirmation(step.confirmation)
    }, 0)
    return () => clearTimeout(timer)
  }, [router])

  async function submit({ newPassword }: NewPasswordValues) {
    if (!confirmation || wait > 0 || reset.isPending) return
    form.clearErrors()
    const result = await submitNewPassword(
      confirmation,
      newPassword,
      reset.mutateAsync,
    )
    if ("redirect" in result) {
      if (result.toast) toast.error(result.toast)
      router.replace(result.redirect)
      return
    }
    const { action, error } = result
    if (action === "unknown") {
      toast.error(GENERIC_ERROR)
      return
    }
    if (action === "in-progress") return
    setFormError(form, error)
    if (action === "throttled")
      startCooldown(
        (error instanceof ApiError && error.retryAfterSeconds) || 60,
      )
  }

  if (!confirmation)
    return (
      <Loader
        label="Подготавливаем форму…"
        className="py-8 text-muted-foreground"
      />
    )

  return (
    <Form form={form} onSubmit={submit} busy={busy} className="gap-5">
      <p className="break-words text-sm text-muted-foreground">
        Код подтверждён. Придумайте новый пароль для{" "}
        <strong className="text-foreground">{confirmation.email}</strong>.
      </p>
      <FormAlert message={form.formState.errors.root?.message} />
      <FieldGroup>
        <FormField
          name="newPassword"
          label="Новый пароль"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Придумайте новый пароль"
          description="Не менее 8 символов."
          disabled={busy}
          autoFocus
          required
        />
        <FormField
          name="confirmPassword"
          label="Повторите пароль"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Введите пароль ещё раз"
          disabled={busy}
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
        disabled={busy || wait > 0}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Сменить пароль"}
      </LoadingButton>
    </Form>
  )
}
