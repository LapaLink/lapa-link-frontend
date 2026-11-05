"use client"

import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError, adoptionApi, getErrorMessage } from "@/api"
import {
  ADOPTION_MESSAGE_MAX,
  PETS_DETAILS_MAX,
  experienceOptions,
  housingOptions,
  ownerConsentOptions,
  petsHealthOptions,
  travelOptions,
} from "@/lib/adoption"
import type { AdoptionQuestionnaire } from "@/types"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components/ui"

type Draft = {
  message: string
  housingType: string
  ownerConsent: string
  familyAgreement: boolean
  hasYoungChildren: boolean
  petExperience: string
  hasCurrentPets: boolean
  currentPetsDetails: string
  currentPetsHealthStatus: string
  travelPlan: string
  readyForSterilization: boolean
}

const empty: Draft = {
  message: "",
  housingType: "",
  ownerConsent: "",
  familyAgreement: false,
  hasYoungChildren: false,
  petExperience: "",
  hasCurrentPets: false,
  currentPetsDetails: "",
  currentPetsHealthStatus: "",
  travelPlan: "",
  readyForSterilization: false,
}

const PICK = "Выберите вариант."

function SelectField({
  id,
  label,
  value,
  options,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={!!error}>
          <SelectValue placeholder="Выберите" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-medium"
    >
      {label}
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

/**
 * Request to take the animal home: a message and the base questionnaire in
 * one form. Consent of the owner is asked only for rented housing (else
 * NOT_REQUIRED is sent); current pets add details and their health status.
 */
export function AdoptionFormDialog({
  open,
  onOpenChange,
  caseId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
}) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<Draft>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // State lags behind a fast double click, so guard synchronously.
  const sending = useRef(false)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const rented = draft.housingType === "RENTED_APARTMENT"

  async function submit() {
    if (sending.current) return
    setError("")
    const found: typeof errors = {}
    const message = draft.message.trim()
    const details = draft.currentPetsDetails.trim()
    if (!message) found.message = "Расскажите автору о себе."
    if (!draft.housingType) found.housingType = PICK
    if (rented && !draft.ownerConsent) found.ownerConsent = PICK
    if (!draft.petExperience) found.petExperience = PICK
    if (!draft.travelPlan) found.travelPlan = PICK
    if (draft.hasCurrentPets) {
      if (!details) found.currentPetsDetails = "Укажите, кто и сколько."
      if (!draft.currentPetsHealthStatus) found.currentPetsHealthStatus = PICK
    }
    setErrors(found)
    if (Object.keys(found).length) return

    const questionnaire = {
      housingType: draft.housingType,
      ownerConsent: rented ? draft.ownerConsent : "NOT_REQUIRED",
      familyAgreement: draft.familyAgreement,
      hasYoungChildren: draft.hasYoungChildren,
      petExperience: draft.petExperience,
      hasCurrentPets: draft.hasCurrentPets,
      ...(draft.hasCurrentPets && {
        currentPetsDetails: details,
        currentPetsHealthStatus: draft.currentPetsHealthStatus,
      }),
      travelPlan: draft.travelPlan,
      readyForSterilization: draft.readyForSterilization,
    } as AdoptionQuestionnaire
    sending.current = true
    setBusy(true)
    try {
      await adoptionApi.create(caseId, message, questionnaire)
      setDraft(empty)
      onOpenChange(false)
      toast.success("Заявка отправлена")
      void client.invalidateQueries({
        queryKey: ["account", "adoption-requests"],
      })
      // «Написать автору» becomes available without a reload.
      void client.invalidateQueries({ queryKey: ["chat", "permission"] })
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined
      const text = getErrorMessage(cause, "Не удалось отправить заявку.")
      if (code === "VALIDATION_FAILED" && cause instanceof ApiError) {
        const fields = cause.fields
        if (fields.message) setErrors({ message: fields.message })
        else setError(text)
      } else if (code === "ADOPTION_REQUEST_ALREADY_EXISTS") {
        toast.info(text)
        onOpenChange(false)
        void client.invalidateQueries({
          queryKey: ["account", "adoption-requests"],
        })
      } else setError(text)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Заявка на постоянный дом</DialogTitle>
          <DialogDescription>
            Ответьте на несколько вопросов — автор увидит анкету и сможет
            написать вам.
          </DialogDescription>
        </DialogHeader>
        <FormAlert message={error} />
        <div className="flex flex-col gap-4">
          <Field data-invalid={!!errors.message}>
            <FieldLabel htmlFor="adoption-message">Сообщение автору</FieldLabel>
            <Textarea
              id="adoption-message"
              className="min-h-24"
              maxLength={ADOPTION_MESSAGE_MAX}
              value={draft.message}
              aria-invalid={!!errors.message}
              placeholder="Расскажите о себе и почему хотите забрать животное"
              onChange={(event) => set("message", event.target.value)}
            />
            <FieldDescription className="text-right">
              {draft.message.length} / {ADOPTION_MESSAGE_MAX}
            </FieldDescription>
            <FieldError>{errors.message}</FieldError>
          </Field>
          <SelectField
            id="adoption-housing"
            label="Тип жилья"
            value={draft.housingType}
            options={housingOptions}
            error={errors.housingType}
            onChange={(value) => set("housingType", value)}
          />
          {rented && (
            <SelectField
              id="adoption-owner"
              label="Согласие собственника жилья"
              value={draft.ownerConsent}
              options={ownerConsentOptions}
              error={errors.ownerConsent}
              onChange={(value) => set("ownerConsent", value)}
            />
          )}
          <ToggleField
            id="adoption-family"
            label="Все члены семьи согласны"
            checked={draft.familyAgreement}
            onChange={(value) => set("familyAgreement", value)}
          />
          <ToggleField
            id="adoption-children"
            label="Есть дети до 7 лет"
            checked={draft.hasYoungChildren}
            onChange={(value) => set("hasYoungChildren", value)}
          />
          <SelectField
            id="adoption-experience"
            label="Опыт содержания животных"
            value={draft.petExperience}
            options={experienceOptions}
            error={errors.petExperience}
            onChange={(value) => set("petExperience", value)}
          />
          <ToggleField
            id="adoption-pets"
            label="Есть питомцы сейчас"
            checked={draft.hasCurrentPets}
            onChange={(value) => set("hasCurrentPets", value)}
          />
          {draft.hasCurrentPets && (
            <>
              <Field data-invalid={!!errors.currentPetsDetails}>
                <FieldLabel htmlFor="adoption-pets-details">
                  Кто и сколько
                </FieldLabel>
                <Textarea
                  id="adoption-pets-details"
                  className="min-h-16"
                  maxLength={PETS_DETAILS_MAX}
                  value={draft.currentPetsDetails}
                  aria-invalid={!!errors.currentPetsDetails}
                  placeholder="Например: одна кошка, 3 года"
                  onChange={(event) =>
                    set("currentPetsDetails", event.target.value)
                  }
                />
                <FieldDescription className="text-right">
                  {draft.currentPetsDetails.length} / {PETS_DETAILS_MAX}
                </FieldDescription>
                <FieldError>{errors.currentPetsDetails}</FieldError>
              </Field>
              <SelectField
                id="adoption-pets-health"
                label="Питомцы стерилизованы и вакцинированы"
                value={draft.currentPetsHealthStatus}
                options={petsHealthOptions}
                error={errors.currentPetsHealthStatus}
                onChange={(value) => set("currentPetsHealthStatus", value)}
              />
            </>
          )}
          <SelectField
            id="adoption-travel"
            label="С кем останется животное в поездках"
            value={draft.travelPlan}
            options={travelOptions}
            error={errors.travelPlan}
            onChange={(value) => set("travelPlan", value)}
          />
          <ToggleField
            id="adoption-sterilization"
            label="Готовы стерилизовать или кастрировать по возрасту"
            checked={draft.readyForSterilization}
            onChange={(value) => set("readyForSterilization", value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <LoadingButton
            loading={busy}
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
