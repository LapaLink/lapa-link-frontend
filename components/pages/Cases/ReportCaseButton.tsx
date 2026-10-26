"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Flag } from "lucide-react"
import { toast } from "sonner"
import { complaintsApi, getErrorMessage } from "@/api"
import { FormAlert, LoadingButton } from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Textarea,
} from "@/components/ui"
import type { CreateComplaintDto } from "@/types"

const MESSAGE_MAX = 1000

export function ReportCaseButton({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const report = useMutation({
    mutationFn: (data: CreateComplaintDto) => complaintsApi.create(data),
  })

  function close() {
    if (report.isPending) return
    setOpen(false)
    setError("")
  }

  async function submit() {
    const text = message.trim()
    if (!text) {
      setError("Опишите, что не так с объявлением.")
      return
    }
    setError("")
    try {
      await report.mutateAsync({
        targetType: "CASE",
        targetId: caseId,
        message: text,
      })
      setMessage("")
      setOpen(false)
      toast.success("Жалоба отправлена. Модератор её рассмотрит.")
    } catch (cause) {
      setError(getErrorMessage(cause, "Не удалось отправить жалобу."))
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="h-11 w-full text-muted-foreground sm:h-10 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        <Flag aria-hidden />
        Пожаловаться
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Пожаловаться на объявление</DialogTitle>
            <DialogDescription>
              Модератор проверит объявление. Автор не узнает, кто отправил
              жалобу.
            </DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <Field>
            <FieldLabel htmlFor="report-message">Что не так</FieldLabel>
            <Textarea
              id="report-message"
              autoFocus
              className="min-h-28"
              maxLength={MESSAGE_MAX}
              value={message}
              placeholder="Например: животное продают, а не ищут ему дом."
              onChange={(event) => setMessage(event.target.value)}
            />
            <FieldDescription className="text-right">
              {message.length} / {MESSAGE_MAX}
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={report.isPending}
              onClick={close}
            >
              Отмена
            </Button>
            <LoadingButton
              loading={report.isPending}
              loadingText="Отправляем…"
              onClick={() => void submit()}
            >
              Отправить жалобу
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
