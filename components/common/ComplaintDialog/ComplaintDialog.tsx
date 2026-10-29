"use client"

import { useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, complaintsApi, getErrorMessage } from "@/api"
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
  FieldError,
  FieldLabel,
  Textarea,
} from "@/components/ui"
import type { ComplaintTargetType, CreateComplaintDto } from "@/types"
import { FormAlert } from "../FormAlert/FormAlert"
import { LoadingButton } from "../LoadingButton/LoadingButton"

export const COMPLAINT_MESSAGE_MAX = 1000

/**
 * Complaint form for a case, a user or a conversation. A double click sends
 * one complaint. VALIDATION_FAILED marks the field; CONVERSATION_NOT_FOUND
 * (the chat is gone or the user is not in it) closes the dialog with a toast.
 */
export function ComplaintDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  title,
  description,
  placeholder,
  emptyMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: ComplaintTargetType
  targetId: string
  title: string
  description: string
  placeholder: string
  /** Shown when the reason is empty. */
  emptyMessage: string
}) {
  const [message, setMessage] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [error, setError] = useState("")
  // isPending lags behind a fast double click, so guard synchronously.
  const submitting = useRef(false)
  const report = useMutation({
    mutationFn: (data: CreateComplaintDto) => complaintsApi.create(data),
  })

  function close() {
    if (report.isPending) return
    setFieldError("")
    setError("")
    onOpenChange(false)
  }

  async function submit() {
    if (submitting.current) return
    const text = message.trim()
    setError("")
    if (!text) return setFieldError(emptyMessage)
    setFieldError("")
    submitting.current = true
    try {
      await report.mutateAsync({ targetType, targetId, message: text })
      setMessage("")
      onOpenChange(false)
      toast.success("Жалоба отправлена, модератор её рассмотрит.")
    } catch (cause) {
      const text = getErrorMessage(cause, "Не удалось отправить жалобу.")
      if (cause instanceof ApiError && cause.code === "VALIDATION_FAILED")
        setFieldError(cause.fields.message || text)
      else if (
        cause instanceof ApiError &&
        cause.code === "CONVERSATION_NOT_FOUND"
      ) {
        toast.error(text)
        onOpenChange(false)
      } else setError(text)
    } finally {
      submitting.current = false
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <Field data-invalid={!!fieldError}>
          <FieldLabel htmlFor="complaint-message">Что не так</FieldLabel>
          <Textarea
            id="complaint-message"
            autoFocus
            className="min-h-28"
            maxLength={COMPLAINT_MESSAGE_MAX}
            value={message}
            placeholder={placeholder}
            aria-invalid={!!fieldError}
            aria-describedby="complaint-message-error complaint-message-count"
            onChange={(event) => setMessage(event.target.value)}
          />
          <FieldDescription id="complaint-message-count" className="text-right">
            {message.length} / {COMPLAINT_MESSAGE_MAX}
          </FieldDescription>
          <FieldError id="complaint-message-error">{fieldError}</FieldError>
        </Field>
        <DialogFooter>
          <Button variant="outline" disabled={report.isPending} onClick={close}>
            Отмена
          </Button>
          <LoadingButton
            loading={report.isPending}
            loadingText="Отправляем…"
            onClick={() => void submit()}
          >
            Отправить
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
