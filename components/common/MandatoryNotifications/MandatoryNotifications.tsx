"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, getErrorMessage, inboxApi } from "@/api"
import { queryKeys } from "@/lib/queryKeys"
import type { InboxNotification } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"
import { LoadingButton } from "../LoadingButton/LoadingButton"

/**
 * Modal for an administrator's mandatory notifications, one at a time, oldest
 * first. Closing it (button, cross, Esc or a click outside) marks the
 * notification as read; the next one appears only after the server confirmed
 * it, and on an error the modal stays open with the message. The queue lives
 * in the query cache (filled by GET /inbox/mandatory and by SSE), deduped by
 * id. Title and text are plain text.
 */
export function MandatoryNotifications() {
  const client = useQueryClient()
  const queue = useQuery({
    queryKey: queryKeys.inboxMandatory,
    queryFn: ({ signal }) => inboxApi.mandatory(signal),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const current: InboxNotification | undefined = queue.data?.[0]

  async function markRead(item: InboxNotification) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await inboxApi.read(item.id)
    } catch (cause) {
      // Already read elsewhere: nothing left to confirm.
      if (!(cause instanceof ApiError && cause.status === 404)) {
        setError(getErrorMessage(cause, "Не удалось отметить прочитанным."))
        setBusy(false)
        return
      }
    }
    client.setQueryData<InboxNotification[]>(
      queryKeys.inboxMandatory,
      (list) => list?.filter((entry) => entry.id !== item.id) ?? [],
    )
    // Lists and the unread counter follow the server.
    void client.invalidateQueries({ queryKey: queryKeys.inbox })
    setBusy(false)
  }

  return (
    <Dialog
      open={!!current}
      onOpenChange={(open) => {
        if (!open && current) void markRead(current)
      }}
    >
      {current && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="[overflow-wrap:anywhere]">
              {current.title}
            </DialogTitle>
            <DialogDescription className="max-h-[50dvh] overflow-y-auto whitespace-pre-line [overflow-wrap:anywhere]">
              {current.message}
            </DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <DialogFooter>
            {(queue.data?.length ?? 0) > 1 && (
              <span className="text-sm text-muted-foreground sm:mr-auto sm:self-center">
                Ещё обязательных: {(queue.data?.length ?? 1) - 1}
              </span>
            )}
            <LoadingButton
              loading={busy}
              loadingText="Закрываем…"
              onClick={() => void markRead(current)}
            >
              Закрыть
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
