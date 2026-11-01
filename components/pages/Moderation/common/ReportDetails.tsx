"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { moderationApi, getErrorMessage, ApiError } from "@/api"
import { useAuth, useModerationAction } from "@/hooks"
import {
  moderationDecisionSchema,
  reportStatusLabels,
  reportTargetLabels,
  resolutionLabels,
} from "@/lib/moderation"
import { queryKeys } from "@/lib/queryKeys"
import { ROUTES } from "@/lib/constants"
import {
  Form,
  FormAlert,
  LoadingButton,
  TextAreaField,
} from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
} from "@/components/ui"
import { setFormError } from "@/lib/forms"
import type { ModerationAction } from "@/types"
import { ReportTarget } from "./ReportTarget"

const actionLabels = {
  reject: "Отклонить жалобу",
  warn: "Отправить предупреждение",
  "hide-target": "Скрыть объявление",
  "close-target": "Закрыть объект",
  "block-user": "Заблокировать пользователя",
}
type Decision = keyof typeof actionLabels

export function ReportDetails({
  id,
  onClose,
  onReturnFocus,
}: {
  id: string
  onClose: () => void
  onReturnFocus: () => void
}) {
  const { user } = useAuth()
  const report = useQuery({
    queryKey: queryKeys.moderationReport(id),
    queryFn: ({ signal }) => moderationApi.report(id, signal),
  })
  const target = useQuery({
    queryKey: queryKeys.moderationTarget(id),
    queryFn: ({ signal }) => moderationApi.target(id, signal),
  })
  const mutation = useModerationAction(id, report.data)
  const [decision, setDecision] = useState<Decision | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const form = useForm({
    resolver: zodResolver(moderationDecisionSchema),
    defaultValues: { comment: "" },
  })
  const active =
    report.data?.status === "NEW" || report.data?.status === "IN_PROGRESS"
  const stale =
    mutation.error instanceof ApiError && mutation.error.status === 409

  function choose(action: Decision) {
    form.reset()
    mutation.reset()
    setDecision(action)
  }
  async function submit({ comment }: { comment: string }) {
    if (!decision || mutation.isPending) return
    try {
      await mutation.mutateAsync({
        action: decision,
        comment,
        userId: target.data?.type === "USER" ? target.data.userId : undefined,
      })
      setDecision(null)
      toast.success(
        decision === "block-user"
          ? "Пользователь заблокирован. Завершите рассмотрение жалобы отдельным решением."
          : "Решение сохранено",
      )
    } catch (error) {
      setFormError(form, error)
      if (error instanceof ApiError && error.status === 409) setDecision(null)
    }
  }
  const data = report.data
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) onClose()
        }}
      >
        <DialogContent
          ref={contentRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onReturnFocus()
          }}
          className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>Рассмотрение жалобы</DialogTitle>
            <DialogDescription>
              Решение влияет на объект жалобы. Проверьте сведения перед
              действием.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain pb-1">
            {report.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : report.isError ? (
              <div className="flex flex-col items-start gap-3">
                <FormAlert
                  message={getErrorMessage(report.error, "Жалоба недоступна.")}
                />
                <Button variant="outline" onClick={() => void report.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : (
              data && (
                <>
                  <div className="flex flex-col gap-2 rounded-xl border p-4 text-sm [overflow-wrap:anywhere]">
                    <p className="font-bold">
                      {reportTargetLabels[data.targetType]} ·{" "}
                      {reportStatusLabels[data.status]}
                    </p>
                    <p className="whitespace-pre-wrap">{data.message}</p>
                    <p className="text-muted-foreground">
                      Автор жалобы: {data.reporterId}
                    </p>
                    <p className="text-muted-foreground">
                      Объект: {data.targetId}
                    </p>
                    <p className="text-muted-foreground">
                      Создана: {new Date(data.createdAt).toLocaleString("ru")}
                    </p>
                    {data.resolution && (
                      <p>
                        Решение:{" "}
                        {resolutionLabels[data.resolution] ?? data.resolution}
                      </p>
                    )}
                    {data.moderatorComment && (
                      <p className="whitespace-pre-wrap">
                        Комментарий модератора: {data.moderatorComment}
                      </p>
                    )}
                    {data.moderatedBy && <p>Модератор: {data.moderatedBy}</p>}
                    {data.moderatedAt && (
                      <p>
                        Рассмотрена:{" "}
                        {new Date(data.moderatedAt).toLocaleString("ru")}
                      </p>
                    )}
                  </div>
                  {target.isPending ? (
                    <Skeleton className="h-40 w-full" />
                  ) : target.isError ? (
                    <div className="flex flex-col items-start gap-3">
                      <FormAlert
                        message={getErrorMessage(
                          target.error,
                          "Объект больше недоступен.",
                        )}
                      />
                      <Button
                        variant="outline"
                        onClick={() => void target.refetch()}
                      >
                        Повторить загрузку объекта
                      </Button>
                    </div>
                  ) : (
                    target.data && <ReportTarget target={target.data} />
                  )}
                  <FormAlert
                    message={
                      stale
                        ? "Жалоба или объект уже изменились. Данные обновлены — проверьте текущее состояние перед новым решением."
                        : mutation.isError
                          ? getErrorMessage(
                              mutation.error,
                              "Не удалось сохранить решение.",
                            )
                          : ""
                    }
                  />
                  {active && (
                    <div className="flex flex-wrap gap-2">
                      {data.status === "NEW" && (
                        <LoadingButton
                          loading={mutation.isPending}
                          loadingText="Сохраняем…"
                          className="min-h-11"
                          onClick={() => mutation.mutate({ action: "take" })}
                        >
                          Взять в работу
                        </LoadingButton>
                      )}
                      {(["reject", "warn"] as ModerationAction[]).map(
                        (action) => (
                          <Button
                            key={action}
                            variant="outline"
                            className="min-h-11"
                            disabled={mutation.isPending}
                            onClick={() => choose(action as Decision)}
                          >
                            {actionLabels[action as Decision]}
                          </Button>
                        ),
                      )}
                      {target.data?.type === "CASE" && (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          disabled={mutation.isPending}
                          onClick={() => choose("hide-target")}
                        >
                          Скрыть объявление
                        </Button>
                      )}
                      {(target.data?.type === "CASE" ||
                        target.data?.type === "CONVERSATION") && (
                        <Button
                          variant="destructive"
                          className="min-h-11"
                          disabled={mutation.isPending}
                          onClick={() => choose("close-target")}
                        >
                          {target.data.type === "CASE"
                            ? "Закрыть объявление"
                            : "Закрыть переписку"}
                        </Button>
                      )}
                      {target.data?.type === "USER" &&
                        target.data.status === "ACTIVE" &&
                        target.data.userId !== user?.id && (
                          <Button
                            variant="destructive"
                            className="min-h-11"
                            disabled={mutation.isPending}
                            onClick={() => choose("block-user")}
                          >
                            Заблокировать пользователя
                          </Button>
                        )}
                    </div>
                  )}
                  {data.targetType === "CASE" && (
                    <Button variant="outline" asChild>
                      <Link href={ROUTES.CASE_DETAILS(data.targetId)}>
                        Перейти к объявлению
                      </Link>
                    </Button>
                  )}
                </>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDecision(null)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>
              {decision ? actionLabels[decision] : "Подтвердить решение"}?
            </DialogTitle>
            <DialogDescription>
              {decision === "warn"
                ? "Этот текст получит пользователь. Жалоба будет рассмотрена."
                : "Действие применится после подтверждения. Укажите понятную причину решения."}
            </DialogDescription>
          </DialogHeader>
          <Form form={form} onSubmit={submit} busy={mutation.isPending}>
            <TextAreaField
              name="comment"
              label="Причина решения"
              placeholder="Что установлено при проверке?"
              maxLength={500}
              disabled={mutation.isPending}
              required
            />
            <FormAlert message={form.formState.errors.root?.message} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setDecision(null)}
              >
                Отмена
              </Button>
              <LoadingButton
                type="submit"
                variant={
                  decision === "close-target" ||
                  decision === "block-user" ||
                  decision === "hide-target"
                    ? "destructive"
                    : "default"
                }
                loading={mutation.isPending}
                loadingText="Сохраняем…"
              >
                Подтвердить
              </LoadingButton>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
