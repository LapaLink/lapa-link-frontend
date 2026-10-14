"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useChangePassword, useTransientNotice } from "@/hooks"
import { setFormError } from "@/lib/forms"
import { Lock } from "lucide-react"
import {
  Form,
  FormField,
  FormAlert,
  LoadingButton,
  SectionCard,
} from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldGroup,
} from "@/components/ui"
import { passwordChangeSchema, type PasswordChangeValues } from "../schemas"

export function PasswordChangeCard() {
  const form = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  })
  const change = useChangePassword()
  const [notice, setNotice] = useTransientNotice()
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    if (change.isPending) return
    if (!next) form.reset()
    setOpen(next)
  }

  async function save(values: PasswordChangeValues) {
    form.clearErrors()
    setNotice("")
    try {
      await change.mutateAsync(values)
      form.reset()
      setOpen(false)
      setNotice("Пароль изменён. На других устройствах нужно будет войти заново.")
    } catch (error) {
      if (error instanceof ApiError && error.code === "WRONG_PASSWORD") {
        form.setError(
          "currentPassword",
          { type: "server", message: error.message },
          { shouldFocus: true },
        )
        return
      }
      setFormError(form, error)
    }
  }

  return (
    <SectionCard
      icon={Lock}
      title="Пароль"
      description="Используется для входа в аккаунт."
    >
      {notice && (
        <p role="status" className="text-sm text-success-foreground">
          {notice}
        </p>
      )}
      <Button
        variant="outline"
        className="h-11 self-start sm:h-10"
        onClick={() => handleOpenChange(true)}
      >
        <Lock data-icon="inline-start" />
        Сменить пароль
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Смена пароля</DialogTitle>
            <DialogDescription>
              После смены пароля вы останетесь в аккаунте на этом устройстве.
            </DialogDescription>
          </DialogHeader>
          <Form
            form={form}
            onSubmit={save}
            busy={change.isPending}
            className="gap-5"
          >
            <FormAlert message={form.formState.errors.root?.message} />
            <FieldGroup>
              <FormField
                name="currentPassword"
                label="Текущий пароль"
                type="password"
                autoComplete="current-password"
                placeholder="Введите текущий пароль"
                disabled={change.isPending}
                required
              />
              <FormField
                name="newPassword"
                label="Новый пароль"
                type="password"
                autoComplete="new-password"
                placeholder="Придумайте новый пароль"
                description="Не менее 8 символов."
                disabled={change.isPending}
                required
              />
            </FieldGroup>
            <LoadingButton
              type="submit"
              size="lg"
              loading={change.isPending}
              loadingText="Сохраняем…"
            >
              Сменить пароль
            </LoadingButton>
          </Form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
