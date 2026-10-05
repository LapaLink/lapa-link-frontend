import type { SubmitHandler, UseFormReturn } from "react-hook-form"
import { Form, FormField, FormAlert, LoadingButton } from "@/components/common"
import { FieldGroup } from "@/components/ui"
import type { EmailChangeValues } from "../schemas"

type EmailRequestFormProps = {
  form: UseFormReturn<EmailChangeValues>
  busy: boolean
  blocked: boolean
  wait: number
  onSubmit: SubmitHandler<EmailChangeValues>
}

export function EmailRequestForm({
  form,
  busy,
  blocked,
  wait,
  onSubmit,
}: EmailRequestFormProps) {
  return (
    <Form
      form={form}
      onSubmit={onSubmit}
      busy={busy}
      autoComplete="off"
      className="gap-5"
    >
      <p className="text-sm text-muted-foreground">
        Подтвердим новую почту кодом из письма. Для вашей безопасности
        понадобится текущий пароль.
      </p>
      <FormAlert message={form.formState.errors.root?.message} />
      <FieldGroup>
        <FormField
          name="newEmail"
          label="Новый email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          maxLength={320}
          disabled={busy || blocked}
          required
        />
        <FormField
          name="password"
          label="Текущий пароль"
          type="password"
          autoComplete="off"
          placeholder="Введите текущий пароль"
          disabled={busy || blocked}
          required
        />
      </FieldGroup>
      <LoadingButton
        type="submit"
        size="lg"
        loading={busy}
        loadingText="Отправляем код…"
        disabled={blocked || wait > 0}
      >
        {wait > 0 ? `Получить код через ${wait} с` : "Получить код"}
      </LoadingButton>
    </Form>
  )
}
