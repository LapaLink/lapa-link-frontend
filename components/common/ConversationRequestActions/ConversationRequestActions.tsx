"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useAcceptConversation, useDeclineConversation } from "@/hooks"
import { chatErrorMessage } from "@/lib/chat"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/ui"
import { LoadingButton } from "../LoadingButton/LoadingButton"

/** Owner's accept/decline controls for a chat request; declining asks for confirmation. */
export function ConversationRequestActions({
  conversationId,
  requesterName,
}: {
  conversationId: string
  requesterName: string
}) {
  const accept = useAcceptConversation()
  const decline = useDeclineConversation()
  const [confirming, setConfirming] = useState(false)
  const busy = accept.isPending || decline.isPending
  const onError = (error: unknown) =>
    toast.error(chatErrorMessage(error, "Не удалось обработать запрос на чат."))
  return (
    <div className="flex flex-wrap gap-2">
      <LoadingButton
        size="sm"
        loading={accept.isPending}
        loadingText="Принимаем…"
        disabled={busy}
        onClick={() => accept.mutate(conversationId, { onError })}
      >
        Принять
      </LoadingButton>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Отклонить
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить запрос на чат?</AlertDialogTitle>
            <AlertDialogDescription>
              {requesterName} не сможет написать вам по этому объявлению и
              повторно запросить чат.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => decline.mutate(conversationId, { onError })}
            >
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
