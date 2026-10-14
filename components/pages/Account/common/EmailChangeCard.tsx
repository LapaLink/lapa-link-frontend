"use client"

import { useState } from "react"
import { Mail, Pencil } from "lucide-react"
import { SectionCard, StatusBadge } from "@/components/common"
import {
  Button,
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
    <SectionCard
      icon={Mail}
      title="Электронная почта"
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-all font-medium text-foreground">{email}</span>
          {verified !== undefined && (
            <StatusBadge tone={verified ? "success" : "muted"}>
              {verified ? "подтверждён" : "не подтверждён"}
            </StatusBadge>
          )}
        </span>
      }
    >
      {!open && change.notice && (
        <p role="status" className="text-sm text-success-foreground">
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
        className="h-11 self-start sm:h-10"
        onClick={() => setOpen(true)}
      >
        {!change.pending && <Pencil data-icon="inline-start" />}
        {change.pending ? "Ввести код" : "Изменить email"}
      </Button>
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
    </SectionCard>
  )
}
