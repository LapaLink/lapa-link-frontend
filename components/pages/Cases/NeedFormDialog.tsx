"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, casesApi } from "@/api"
import { useDictionaryLocale, useNeedTypes } from "@/hooks"
import { setFormError } from "@/lib/forms"
import { toLocalDateTimeInput } from "@/lib/needs"
import { invalidateTaskData } from "@/lib/queryKeys"
import type { CaseNeed, NeedPriority } from "@/types"
import {
  CaseSelectField,
  Form,
  FormAlert,
  FormField,
  LoadingButton,
  TextAreaField,
} from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldGroup,
  FieldLegend,
  FieldSet,
  SelectItem,
} from "@/components/ui"
import { getDictionaryName } from "@/lib/dictionaries"
import {
  FOSTER_DAYS_MAX,
  NEED_AREA_MAX,
  NEED_CARGO_MAX,
  NEED_COMMENT_MAX,
  NEED_CONDITIONS_MAX,
  getNeedFormValues,
  needFormSchema,
  needPriorityLabels,
  toCreateNeedDto,
  toUpdateNeedDto,
  type NeedFormValues,
} from "./schemas"

const priorities: NeedPriority[] = ["LOW", "MEDIUM", "HIGH"]

/** Author's dialog to add a need to an open case or edit a need that is not closed. */
export function NeedFormDialog({
  caseId,
  need,
  open,
  onOpenChange,
}: {
  caseId: string
  /** Need to edit; omitted to add a new one. */
  need?: CaseNeed
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <NeedForm
            caseId={caseId}
            need={need}
            onDone={() => onOpenChange(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  )
}

function NeedForm({
  caseId,
  need,
  onDone,
}: {
  caseId: string
  need?: CaseNeed
  onDone: () => void
}) {
  const client = useQueryClient()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const [schema] = useState(() => needFormSchema(need))
  // Earliest deadline the picker offers; the schema re-checks on submit.
  const [minDeadline] = useState(() =>
    toLocalDateTimeInput(new Date().toISOString()),
  )
  const form = useForm<NeedFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getNeedFormValues(need),
  })
  const type = useWatch({ control: form.control, name: "type" })
  // Fields of the type picked before would be rejected (NEED_DETAILS_INVALID).
  const shownType = useRef(type)
  useEffect(() => {
    if (shownType.current === type) return
    shownType.current = type
    form.setValue("details", getNeedFormValues().details)
  }, [form, type])
  const save = useMutation({
    mutationFn: async (values: NeedFormValues) => {
      if (!need) {
        const { type, ...details } = toCreateNeedDto(values)
        return casesApi.addNeed(caseId, type, details)
      }
      const changes = toUpdateNeedDto(values, need)
      if (Object.keys(changes).length)
        return casesApi.updateNeed(caseId, need.id, changes)
    },
    onSuccess: async () => {
      onDone()
      await invalidateTaskData(client, caseId)
    },
    onError: (error) => {
      // Shown inside the details block only, not above the form.
      if (error instanceof ApiError && error.code === "NEED_DETAILS_INVALID")
        return form.setError("details", {
          type: "server",
          message: error.message,
        })
      setFormError(form, error)
      if (error instanceof ApiError) {
        if (error.code === "NEED_TIME_WINDOW_INVALID")
          form.setError("deadline", { type: "server", message: error.message })
        // The need or the case was closed meanwhile: show the actual state.
        if (["NEED_CLOSED", "CASE_CLOSED", "CASE_NOT_FOUND"].includes(error.code ?? ""))
          void invalidateTaskData(client, caseId)
      }
      // Field errors stay under the fields, the message is shown above them.
      if (error instanceof Error) form.setError("root", { message: error.message })
    },
  })
  const rootError = form.formState.errors.root?.message
  const detailsError = form.formState.errors.details?.message
  const retryable =
    save.error instanceof ApiError && save.error.code === "OPERATION_IN_PROGRESS"

  return (
    <Form
      form={form}
      busy={save.isPending}
      onSubmit={(values) => {
        form.clearErrors()
        save.mutate(values)
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {need
            ? getDictionaryName(needTypes.data, need.type, locale)
            : "Добавить потребность"}
        </DialogTitle>
        <DialogDescription>
          {need
            ? "Уточните приоритет, сроки и детали."
            : "Выберите, какая помощь нужна, и при необходимости укажите сроки."}
        </DialogDescription>
      </DialogHeader>
      <FormAlert message={rootError} />
      <fieldset disabled={save.isPending} className="flex min-w-0 flex-col">
        <FieldGroup>
          {!need && (
            <CaseSelectField
              name="type"
              label="Вид помощи"
              placeholder={
                needTypes.isPending ? "Загружаем…" : "Выберите вид помощи"
              }
            >
              {needTypes.data
                ?.filter((type) => type.active)
                .map((type) => (
                  <SelectItem key={type.code} value={type.code}>
                    {getDictionaryName(needTypes.data, type.code, locale)}
                  </SelectItem>
                ))}
            </CaseSelectField>
          )}
          <FieldSet>
            <FieldLegend variant="label">Приоритет</FieldLegend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {priorities.map((priority) => (
                <label
                  key={priority}
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-semibold text-muted-foreground transition-colors has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-xs has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40"
                >
                  <input
                    type="radio"
                    value={priority}
                    className="sr-only"
                    {...form.register("priority")}
                  />
                  {needPriorityLabels[priority]}
                </label>
              ))}
            </div>
          </FieldSet>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              name="startsAt"
              label="С"
              type="datetime-local"
              description={need?.startsAt ? undefined : "Необязательно"}
            />
            <FormField
              name="deadline"
              label="До"
              type="datetime-local"
              min={minDeadline}
              description={need?.deadline ? undefined : "Необязательно"}
            />
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Если до срока никто не будет выбран исполнителем, потребность
              закроется автоматически.
            </p>
          </div>
          {type === "TRANSPORT" && (
            <FieldSet>
              <FieldLegend variant="label">Детали перевозки</FieldLegend>
              <FormAlert message={detailsError} />
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  name="details.fromArea"
                  label="Откуда (район)"
                  placeholder="Например: Фрунзенский"
                  maxLength={NEED_AREA_MAX}
                />
                <FormField
                  name="details.toArea"
                  label="Куда (район)"
                  placeholder="Например: Заводской"
                  maxLength={NEED_AREA_MAX}
                />
              </div>
              <TextAreaField
                name="details.cargo"
                label="Что перевозим"
                placeholder="Например: кошка в переноске"
                maxLength={NEED_CARGO_MAX}
              />
            </FieldSet>
          )}
          {type === "FOSTER" && (
            <FieldSet>
              <FieldLegend variant="label">Детали передержки</FieldLegend>
              <FormAlert message={detailsError} />
              <FormField
                name="details.periodDays"
                label="Срок передержки, дней"
                type="number"
                inputMode="numeric"
                min={1}
                max={FOSTER_DAYS_MAX}
                step={1}
                className="sm:max-w-40"
              />
              <TextAreaField
                name="details.conditions"
                label="Условия"
                placeholder="Например: без других животных, нужна отдельная комната"
                maxLength={NEED_CONDITIONS_MAX}
              />
            </FieldSet>
          )}
          <TextAreaField
            name="comment"
            label="Комментарий"
            placeholder="Например: нужна переноска для крупной собаки"
            maxLength={NEED_COMMENT_MAX}
          />
        </FieldGroup>
      </fieldset>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={onDone}
        >
          Отмена
        </Button>
        <LoadingButton
          type="submit"
          loading={save.isPending}
          loadingText="Сохраняем…"
        >
          {retryable ? "Повторить" : need ? "Сохранить" : "Добавить"}
        </LoadingButton>
      </DialogFooter>
    </Form>
  )
}
