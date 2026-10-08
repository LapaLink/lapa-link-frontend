"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import { useChangePassword, useTransientNotice } from "@/hooks"
import { setFormError } from "@/lib/forms"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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

  async function save(values: PasswordChangeValues) {
    form.clearErrors()
    setNotice("")
    try {
      await change.mutateAsync(values)
      form.reset()
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Пароль</h2>
        </CardTitle>
        <CardDescription>
          После смены пароля вы останетесь в аккаунте на этом устройстве.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {notice && (
          <p role="status" className="text-sm text-primary">
            {notice}
          </p>
        )}
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
      </CardContent>
    </Card>
  )
}
