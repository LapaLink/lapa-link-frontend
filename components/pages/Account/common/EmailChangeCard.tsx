"use client"

import { useState } from "react"
import { Mail, Pencil, Phone } from "lucide-react"
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
  phone,
}: {
  email: string
  verified?: boolean
  /** When given, the phone is listed too; it is edited in «Личные данные». */
  phone?: { number: string | null; confirmed: boolean }
}) {
  const [open, setOpen] = useState(false)
  const change = useEmailChange(() => setOpen(false))
  return (
    <SectionCard
      icon={Mail}
      title="Контакты"
      description="Укажите, как с вами связаться."
      fullWidthBody
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70"
        >
          <Mail className="size-4" />
        </span>
        <span className="sr-only">Электронная почта: </span>
        <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
          {email}
        </span>
        {verified !== undefined && (
          <StatusBadge
            tone={verified ? "success" : "muted"}
            className="whitespace-nowrap"
          >
            {verified ? "Подтверждён" : "Не подтверждён"}
          </StatusBadge>
        )}
      </p>
      {phone && (
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70"
          >
            <Phone className="size-4" />
          </span>
          <span className="sr-only">Номер телефона: </span>
          {phone.number ? (
            <>
              <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                {phone.number}
              </span>
              <StatusBadge
                tone={phone.confirmed ? "success" : "muted"}
                className="whitespace-nowrap"
              >
                {phone.confirmed ? "Подтверждён" : "Не подтверждён"}
              </StatusBadge>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Не указан</span>
          )}
          {/* A plain anchor: the profile switches sections on hashchange. */}
          <a
            href="#personal"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {phone.number ? "Изменить" : "Добавить"}
          </a>
        </p>
      )}
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
        className="h-11 self-start rounded-full px-5 sm:h-10"
        onClick={() => setOpen(true)}
      >
        {!change.pending && <Pencil data-icon="inline-start" />}
        {change.pending ? "Ввести код" : "Изменить"}
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
