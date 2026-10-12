"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/api"
import { useCompleteRegistration, useCooldown } from "@/hooks"
import type { OtpConfirmation } from "@/lib/auth"
import {
  Form,
  FormAlert,
  FormField,
  Loader,
  LoadingButton,
} from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import {
  completeRegistrationSchema,
  type CompleteRegistrationValues,
} from "../schemas"
import { setFormError } from "@/lib/forms"
import { useAuthRedirect } from "../hooks/useAuthRedirect"
import { GENERIC_ERROR, openConfirmedStep } from "../otpFlow"
import { registrationFlow, submitRegistration } from "../registrationFlow"

export function CompleteRegistrationForm() {
  const form = useForm<CompleteRegistrationValues>({
    resolver: zodResolver(completeRegistrationSchema),
    defaultValues: { displayName: "", password: "", confirmPassword: "" },
  })
  const [confirmation, setConfirmation] = useState<OtpConfirmation | null>(
    null,
  )
  const [showPassword, setShowPassword] = useState(false)
  const complete = useCompleteRegistration()
  const router = useRouter()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  const busy = form.formState.isSubmitting || complete.isPending
  useAuthRedirect()

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = openConfirmedStep(registrationFlow)
      if ("redirect" in step) router.replace(step.redirect)
      else setConfirmation(step.confirmation)
    }, 0)
    return () => clearTimeout(timer)
  }, [router])

  async function submit({ displayName, password }: CompleteRegistrationValues) {
    if (!confirmation || wait > 0 || complete.isPending) return
    form.clearErrors()
    const result = await submitRegistration(
      confirmation,
      { displayName, password },
      complete.mutateAsync,
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
        Почта{" "}
        <strong className="text-foreground">{confirmation.email}</strong>{" "}
        подтверждена.
      </p>
      <FormAlert message={form.formState.errors.root?.message} />
      <FieldGroup>
        <FormField
          name="displayName"
          label="Ваше имя"
          autoComplete="name"
          placeholder="Как к вам обращаться?"
          maxLength={100}
          disabled={busy}
          autoFocus
          required
        />
        <FormField
          name="password"
          label="Пароль"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Придумайте пароль"
          description="Не менее 8 символов."
          disabled={busy}
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
          aria-controls="password confirmPassword"
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {showPassword ? "Скрыть пароль" : "Показать пароль"}
        </Button>
      </FieldGroup>
      <LoadingButton
        type="submit"
        size="lg"
        loading={complete.isPending}
        loadingText="Создаём аккаунт…"
        disabled={busy || wait > 0}
      >
        {wait > 0 ? `Попробовать через ${wait} с` : "Создать аккаунт"}
      </LoadingButton>
    </Form>
  )
}
