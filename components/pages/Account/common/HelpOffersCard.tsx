"use client"

import { useState } from "react"
import { cn } from "cn"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HandHeart, Pencil, Plus, Trash2 } from "lucide-react"
import { ApiError, accountApi, getErrorMessage } from "@/api"
import { useDictionaryLocale, useNeedTypes } from "@/hooks"
import { getDictionaryName } from "@/lib/dictionaries"
import { setFormError } from "@/lib/forms"
import { queryKeys } from "@/lib/queryKeys"
import type { CurrentUser, HelpOffer } from "@/types"
import {
  CaseSelectField,
  Form,
  FormAlert,
  LoadingButton,
  SectionCard,
  TextAreaField,
} from "@/components/common"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  SelectItem,
  Skeleton,
  Switch,
} from "@/components/ui"
import {
  HELP_OFFER_AVAILABILITY_MAX,
  getAvailableHelpTypes,
  getHelpOfferValues,
  helpOfferSchema,
  toCreateHelpOfferDto,
  toUpdateHelpOfferDto,
  type HelpOfferValues,
} from "../schemas"

/**
 * "Готовность помогать": the kinds of help the user offers, with a radius
 * from the home point ("Мой район") and free-text availability. Offers can be switched
 * off temporarily without deleting them.
 */
export function HelpOffersCard({ user }: { user: CurrentUser }) {
  const client = useQueryClient()
  const locale = useDictionaryLocale()
  const needTypes = useNeedTypes()
  const offers = useQuery({
    queryKey: queryKeys.helpOffers,
    queryFn: ({ signal }) => accountApi.getHelpOffers(signal),
  })
  // Offer form: `{}` adds an offer, `{ offer }` edits it, null keeps it closed.
  const [editing, setEditing] = useState<{ offer?: HelpOffer } | null>(null)
  const [removing, setRemoving] = useState<HelpOffer | null>(null)
  const [error, setError] = useState("")

  const setActive = (id: string, active: boolean) =>
    client.setQueryData<HelpOffer[]>(queryKeys.helpOffers, (current) =>
      current?.map((offer) => (offer.id === id ? { ...offer, active } : offer)),
    )
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      accountApi.updateHelpOffer(id, { active }),
    onMutate: async ({ id, active }) => {
      setError("")
      await client.cancelQueries({ queryKey: queryKeys.helpOffers })
      setActive(id, active)
    },
    onSuccess: (updated) =>
      client.setQueryData<HelpOffer[]>(queryKeys.helpOffers, (current) =>
        current?.map((offer) => (offer.id === updated.id ? updated : offer)),
      ),
    onError: (mutationError, { id, active }) => {
      setActive(id, !active)
      setError(getErrorMessage(mutationError, "Не удалось сохранить изменение."))
      if (mutationError instanceof ApiError && mutationError.status === 404)
        void client.invalidateQueries({ queryKey: queryKeys.helpOffers })
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => accountApi.deleteHelpOffer(id),
    onMutate: () => setError(""),
    onSettled: () =>
      client.invalidateQueries({ queryKey: queryKeys.helpOffers }),
    onError: (mutationError) =>
      setError(getErrorMessage(mutationError, "Не удалось удалить вид помощи.")),
  })

  const availableTypes = getAvailableHelpTypes(needTypes.data, offers.data)
  const typeName = (code: string) =>
    getDictionaryName(needTypes.data, code, locale)

  return (
    <SectionCard
      icon={HandHeart}
      title="Готовность помогать"
      description="Отметьте, чем вы готовы помогать, — будем присылать объявления рядом, где нужна такая помощь."
      fullWidthBody
    >
      {!!offers.data?.length && user.homeLatitude == null && (
        <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
          <a
            href="#home-area"
            className="font-semibold underline underline-offset-2 hover:text-primary-hover"
          >
            Укажите домашнюю точку
          </a>
          , чтобы учитывался радиус.
        </p>
      )}
      {offers.isPending ? (
        <div
          role="status"
          aria-label="Загружаем виды помощи"
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : offers.isError ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert
            message={getErrorMessage(
              offers.error,
              "Не удалось загрузить виды помощи.",
            )}
          />
          <Button variant="outline" onClick={() => void offers.refetch()}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : (
        offers.data.length > 0 && (
          <ul className="divide-y rounded-2xl border bg-background/60 px-3 sm:px-4">
            {offers.data.map((offer) => {
              const switchId = `help-offer-${offer.id}`
              return (
                <li
                  key={offer.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5",
                      !offer.active && "opacity-60",
                    )}
                  >
                    <p className="font-semibold [overflow-wrap:anywhere]">
                      {typeName(offer.type)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      до {offer.radiusKm} км
                      {!offer.active && " · Временно выключено"}
                    </p>
                    {offer.availability && (
                      <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                        {offer.availability}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={switchId}
                      className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 text-sm font-medium sm:flex-none"
                    >
                      <Switch
                        id={switchId}
                        checked={offer.active}
                        disabled={
                          toggle.isPending && toggle.variables?.id === offer.id
                        }
                        onCheckedChange={(active) =>
                          toggle.mutate({ id: offer.id, active })
                        }
                      />
                      Активно
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 sm:size-10"
                      aria-label={`Изменить: ${typeName(offer.type)}`}
                      onClick={() => setEditing({ offer })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 text-destructive hover:text-destructive sm:size-10"
                      aria-label={`Удалить: ${typeName(offer.type)}`}
                      disabled={remove.isPending}
                      onClick={() => setRemoving(offer)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      )}
      <FormAlert message={error} />
      {offers.isSuccess && availableTypes.length > 0 && (
        <Button
          variant="outline"
          className="h-11 w-full sm:h-10 sm:w-fit"
          onClick={() => setEditing({})}
        >
          <Plus aria-hidden />
          Добавить вид помощи
        </Button>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        {editing && (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
            <HelpOfferForm
              offer={editing.offer}
              types={availableTypes}
              typeName={typeName}
              onDone={() => setEditing(null)}
            />
          </DialogContent>
        )}
      </Dialog>

      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вид помощи?</AlertDialogTitle>
            <AlertDialogDescription>
              «{removing && typeName(removing.type)}» пропадёт из списка. Если
              нужно лишь на время перестать помогать, просто выключите его.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate(removing.id)
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}

function HelpOfferForm({
  offer,
  types,
  typeName,
  onDone,
}: {
  /** Offer to edit; omitted to create one. */
  offer?: HelpOffer
  /** Types offered when creating: active ones without an offer yet. */
  types: { code: string }[]
  typeName: (code: string) => string
  onDone: () => void
}) {
  const client = useQueryClient()
  const form = useForm<HelpOfferValues>({
    resolver: zodResolver(helpOfferSchema),
    defaultValues: getHelpOfferValues(offer),
  })
  const save = useMutation({
    mutationFn: async (values: HelpOfferValues) => {
      if (!offer) return accountApi.createHelpOffer(toCreateHelpOfferDto(values))
      const changes = toUpdateHelpOfferDto(values, offer)
      if (Object.keys(changes).length)
        return accountApi.updateHelpOffer(offer.id, changes)
    },
    onSuccess: async () => {
      onDone()
      await client.invalidateQueries({ queryKey: queryKeys.helpOffers })
    },
    onError: (error) => {
      setFormError(form, error)
      // Field errors stay under the fields, the message is shown above them.
      if (error instanceof Error) form.setError("root", { message: error.message })
      if (
        error instanceof ApiError &&
        ["HELP_OFFER_ALREADY_EXISTS", "HELP_OFFER_NOT_FOUND"].includes(
          error.code ?? "",
        )
      )
        void client.invalidateQueries({ queryKey: queryKeys.helpOffers })
    },
  })

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
          {offer ? typeName(offer.type) : "Добавить вид помощи"}
        </DialogTitle>
        <DialogDescription>
          Укажите, как далеко от домашней точки готовы помогать и когда вам
          удобно.
        </DialogDescription>
      </DialogHeader>
      <FormAlert message={form.formState.errors.root?.message} />
      <fieldset disabled={save.isPending} className="flex min-w-0 flex-col">
        <FieldGroup>
          {!offer && (
            <CaseSelectField
              name="type"
              label="Вид помощи"
              placeholder="Выберите вид помощи"
            >
              {types.map((type) => (
                <SelectItem key={type.code} value={type.code}>
                  {typeName(type.code)}
                </SelectItem>
              ))}
            </CaseSelectField>
          )}
          <Controller
            control={form.control}
            name="radiusKm"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error}>
                <FieldLabel htmlFor="radiusKm">Радиус, км</FieldLabel>
                <Input
                  ref={field.ref}
                  id="radiusKm"
                  name={field.name}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                    )
                  }
                  aria-invalid={!!fieldState.error}
                  aria-describedby="radiusKm-description radiusKm-error"
                />
                <FieldDescription id="radiusKm-description">
                  От 1 до 100 км от домашней точки.
                </FieldDescription>
                <FieldError id="radiusKm-error">
                  {fieldState.error?.message}
                </FieldError>
              </Field>
            )}
          />
          <TextAreaField
            name="availability"
            label="Когда удобно"
            placeholder="Например: будни после 18:00"
            maxLength={HELP_OFFER_AVAILABILITY_MAX}
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
          {offer ? "Сохранить" : "Добавить"}
        </LoadingButton>
      </DialogFooter>
    </Form>
  )
}
