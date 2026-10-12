"use client"

import { useState } from "react"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { useEmailChange } from "../hooks/useEmailChange"
import { EmailRequestForm } from "./EmailRequestForm"
import { EmailConfirmationForm } from "./EmailConfirmationForm"

export function EmailChangeCard({
  email,
  verified,
}: {
  email: string
  verified?: boolean
}) {
  const [open, setOpen] = useState(false)
  const change = useEmailChange(() => setOpen(false))
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Электронная почта</h2>
        </CardTitle>
        <CardDescription>
          <span className="break-all">{email}</span>
          {verified !== undefined && (
            <span
              className={
                verified
                  ? "ml-2 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary"
                  : "ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {verified ? "подтверждён" : "не подтверждён"}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!open && change.notice && (
          <p role="status" className="text-sm text-primary">
            {change.notice}
          </p>
        )}
        {change.pending && (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Ждём подтверждения {change.pending.email}
          </p>
        )}
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {change.pending ? "Ввести код" : "Изменить email"}
        </Button>
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!change.busy) setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Смена email</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </Card>
  )
}
