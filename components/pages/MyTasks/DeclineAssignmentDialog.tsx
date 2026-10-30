"use client"

import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, casesApi, getErrorMessage } from "@/api"
import { invalidateTaskData } from "@/lib/queryKeys"
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
  FieldError,
  FieldLabel,
  Textarea,
} from "@/components/ui"

export const DECLINE_REASON_MAX = 500

// The assignment is gone or no longer active: refresh the lists.
const STALE = ["ASSIGNMENT_NOT_FOUND", "ASSIGNMENT_NOT_ACTIVE"]
// Toast and close; the assignment itself stays as it is.
const TOAST_ONLY = ["NOT_ASSIGNEE", "CASE_HIDDEN"]

/**
 * The helper drops an active assignment with a required reason: the need
 * opens again and the author gets the reason. A double click sends once.
 */
export function DeclineAssignmentDialog({
  assignment,
  onClose,
}: {
  /** The assignment to drop; null keeps the dialog closed. */
  assignment: { id: string; caseId: string; title: string } | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [reason, setReason] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // State lags behind a fast double click, so guard synchronously.
  const submitting = useRef(false)

  function close() {
    if (busy) return
    setReason("")
    setFieldError("")
    setError("")
    onClose()
  }

  async function submit() {
    if (!assignment || submitting.current) return
    const text = reason.trim()
    setError("")
    if (!text)
      return setFieldError("Напишите автору, почему не сможете помочь.")
    setFieldError("")
    submitting.current = true
    setBusy(true)
    try {
      await casesApi.declineAssignment(assignment.id, text)
      setReason("")
      onClose()
      toast.success("Вы отказались от помощи")
      // The exact point of the case is hidden from the helper now.
      void invalidateTaskData(client, assignment.caseId)
    } catch (cause) {
      const message = getErrorMessage(cause, "Не удалось отказаться от помощи.")
      const code = cause instanceof ApiError ? cause.code : undefined
      if (code === "VALIDATION_FAILED")
        setFieldError(
          (cause instanceof ApiError && cause.fields.reason) || message,
        )
      else if (TOAST_ONLY.includes(code ?? "") || STALE.includes(code ?? "")) {
        toast.error(message)
        onClose()
        if (STALE.includes(code ?? ""))
          void invalidateTaskData(client, assignment.caseId)
      } else setError(message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!assignment} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отказаться от помощи</DialogTitle>
          <DialogDescription>
            Потребность снова станет открытой, автор получит уведомление с
            причиной.
            {assignment && ` Объявление: «${assignment.title}».`}
          </DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <Field data-invalid={!!fieldError}>
          <FieldLabel htmlFor="decline-reason">Причина</FieldLabel>
          <Textarea
            id="decline-reason"
            autoFocus
            className="min-h-24"
            maxLength={DECLINE_REASON_MAX}
            value={reason}
            placeholder="Например: заболел, не смогу отвезти"
            aria-invalid={!!fieldError}
            aria-describedby="decline-reason-error decline-reason-count"
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldDescription id="decline-reason-count" className="text-right">
            {reason.length} / {DECLINE_REASON_MAX}
          </FieldDescription>
          <FieldError id="decline-reason-error">{fieldError}</FieldError>
        </Field>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>
            Отмена
          </Button>
          <LoadingButton
            variant="destructive"
            loading={busy}
            loadingText="Отказываемся…"
            onClick={() => void submit()}
          >
            Отказаться
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
