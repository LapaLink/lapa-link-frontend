"use client"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui"
import { useEmailChange } from "../hooks/useEmailChange"
import { EmailRequestForm } from "./EmailRequestForm"
import { EmailConfirmationForm } from "./EmailConfirmationForm"

export function EmailChangeCard({ email }: { email: string }) {
  const change = useEmailChange()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Электронная почта</h2>
        </CardTitle>
        <CardDescription>
          <span className="break-all">Сейчас: {email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {change.notice && (
          <p role="status" className="text-sm text-primary">
            {change.notice}
          </p>
        )}
        {change.pending ? (
          <EmailConfirmationForm
            form={change.codeForm}
            email={change.pending.email}
            busy={change.busy}
            blocked={change.blocked}
            unavailable={change.codeDisabled}
            wait={change.wait}
            expires={change.expires}
            onSubmit={change.confirmCode}
            onResend={() => void change.resendCode()}
            onChangeEmail={change.returnToRequest}
          />
        ) : (
          <EmailRequestForm
            form={change.requestForm}
            busy={change.busy}
            blocked={change.blocked}
            wait={change.wait}
            onSubmit={change.sendCode}
          />
        )}
      </CardContent>
    </Card>
  )
}
