"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ApiError, getErrorMessage, inboxApi } from "@/api"
import { queryKeys } from "@/lib/queryKeys"
import type { InboxNotification } from "@/types"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"
import { LoadingButton } from "../LoadingButton/LoadingButton"

/**
 * Blocking modal for an administrator's mandatory notifications, one at a
 * time, oldest first. No close button, no Esc or outside click: the only way
 * out is «Прочитано», and the next one appears only after the server confirmed
 * it. The queue lives in the query cache (filled by GET /inbox/mandatory and
 * by SSE), deduped by id. Title and text are plain text.
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
    <AlertDialog open={!!current}>
      {current && (
        <AlertDialogContent
          // The modal covers the app until the queue is empty.
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              {current.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="max-h-[50dvh] overflow-y-auto whitespace-pre-line [overflow-wrap:anywhere]">
              {current.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormAlert message={error} />
          <AlertDialogFooter>
            {(queue.data?.length ?? 0) > 1 && (
              <span className="text-sm text-muted-foreground sm:mr-auto sm:self-center">
                Ещё обязательных: {(queue.data?.length ?? 1) - 1}
              </span>
            )}
            <LoadingButton
              loading={busy}
              loadingText="Отмечаем…"
              onClick={() => void markRead(current)}
            >
              Прочитано
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
