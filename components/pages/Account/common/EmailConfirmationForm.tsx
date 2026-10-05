import type { SubmitHandler, UseFormReturn } from "react-hook-form"
import {
  Form,
  FormAlert,
  LoadingButton,
  OtpCodeField,
  ResendCodeButton,
} from "@/components/common"
import { Button, FieldGroup } from "@/components/ui"
import type { EmailConfirmationValues } from "../schemas"

type EmailConfirmationFormProps = {
  form: UseFormReturn<EmailConfirmationValues>
  email: string
  busy: boolean
  blocked: boolean
  unavailable: boolean
  wait: number
  expires: number
  onSubmit: SubmitHandler<EmailConfirmationValues>
  onResend: () => void
  onChangeEmail: () => void
}

export function EmailConfirmationForm({
  form,
  email,
  busy,
  blocked,
  unavailable,
  wait,
  expires,
  onSubmit,
  onResend,
  onChangeEmail,
}: EmailConfirmationFormProps) {
  return (
    <Form
      form={form}
      onSubmit={onSubmit}
      busy={busy}
      autoComplete="off"
      className="gap-5"
    >
      <p className="break-words text-sm text-muted-foreground">
        Мы отправили код на{" "}
        <strong className="break-all text-foreground">{email}</strong>. Введите
        его, чтобы подтвердить новую почту.
      </p>
      <FormAlert message={form.formState.errors.root?.message} />
      <FieldGroup>
        <OtpCodeField
          disabled={busy || unavailable}
          describedBy="email-code-expiry"
          autoFocus
        />
      </FieldGroup>
      <p id="email-code-expiry" className="text-sm text-muted-foreground">
        {expires > 0 && !unavailable
          ? `Код действителен ещё ${expires} с.`
          : "Этот код больше не действует. Запросите новый."}
      </p>
      <LoadingButton
        type="submit"
        size="lg"
        loading={busy}
        loadingText="Подождите…"
        disabled={unavailable}
      >
        Подтвердить
      </LoadingButton>
      <ResendCodeButton
        wait={wait}
        disabled={busy || blocked}
        onClick={onResend}
      />
      <Button
        type="button"
        size="lg"
        variant="ghost"
        disabled={busy || blocked}
        onClick={onChangeEmail}
      >
        Изменить email
      </Button>
    </Form>
  )
}
