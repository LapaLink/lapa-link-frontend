"use client"

import { useForm, useWatch, type UseFormReturn } from "react-hook-form"
import { useState } from "react"
import { cn } from "cn"
import { Pencil, MapPin, UserRound } from "lucide-react"
import { getCityName } from "@/lib/dictionaries"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError, getErrorMessage } from "@/api"
import {
  useDictionaryLocale,
  useCities,
  useTransientNotice,
  useUpdateProfile,
} from "@/hooks"
import type { CurrentUser } from "@/types"
import {
  CaseCityField,
  Form,
  FormField,
  FormAlert,
  LoadingButton,
  SectionCard,
} from "@/components/common"
import {
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  Textarea,
} from "@/components/ui"
import {
  profileSchema,
  toUpdateProfileDto,
  type ProfileValues,
} from "../schemas"

export function valuesOf(user: CurrentUser): ProfileValues {
  return {
    displayName: user.displayName,
    cityCode: user.cityCode ?? "__none",
    bio: user.bio ?? "",
  }
}

/** Puts a failed profile save on the form: field errors under fields, the message on top. */
export function setProfileSaveError(
  form: UseFormReturn<ProfileValues>,
  error: unknown,
) {
  if (error instanceof ApiError && error.code === "UNKNOWN_CITY") {
    form.setError("cityCode", { message: error.message })
    return
  }
  if (error instanceof ApiError) {
    for (const name of ["displayName", "cityCode", "bio"] as const) {
      if (error.fields[name])
        form.setError(name, { message: error.fields[name] })
    }
  }
  form.setError("root", {
    message: getErrorMessage(
      error,
      "Не удалось сохранить изменения. Попробуйте ещё раз.",
    ),
  })
}

/**
 * "Личная информация": name, city and bio in read mode, the edit form in
 * place. Pass `editing` and `onEditingChange` to open the form from outside
 * (the profile summary card); without them the card keeps its own state.
 */
export function ProfileCard({
  user,
  editing: controlledEditing,
  onEditingChange,
}: {
  user: CurrentUser
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}) {
  const [ownEditing, setOwnEditing] = useState(false)
  const editing = controlledEditing ?? ownEditing
  const setEditing = onEditingChange ?? setOwnEditing
  const [notice, setNotice] = useTransientNotice()
  const cities = useCities()
  const locale = useDictionaryLocale()
  const rows = [
    ["Имя", user.displayName],
    [
      "Город",
      <span key="city" className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
        {user.cityCode
          ? getCityName(cities.data, user.cityCode, locale)
          : "Город не указан"}
      </span>,
    ],
    [
      "О себе",
      <span
        key="bio"
        className={cn(
          "block max-h-64 overflow-y-auto overscroll-contain whitespace-pre-wrap leading-relaxed",
          !user.bio?.trim() && "text-muted-foreground",
        )}
      >
        {user.bio?.trim()
          ? user.bio
          : "Расскажите немного о себе и чем можете помочь животным."}
      </span>,
    ],
  ] as const
  return (
    <SectionCard
      className="min-w-0"
      icon={UserRound}
      title="Личная информация"
      description={editing ? "Обновите информацию о себе." : undefined}
      action={
        !editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setNotice("")
              setEditing(true)
            }}
            className="h-11 rounded-full bg-primary-soft px-4 font-semibold text-primary hover:bg-primary-soft/70 hover:text-primary-hover sm:h-10"
          >
            <Pencil data-icon="inline-start" />
            Редактировать
          </Button>
        )
      }
      fullWidthBody
    >
      {editing ? (
        <ProfileEditForm
          user={user}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setNotice("Изменения сохранены")
          }}
        />
      ) : (
        <>
          <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="-mt-3 font-medium [overflow-wrap:anywhere] sm:mt-0">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {notice && (
            <p role="status" className="text-sm text-success-foreground">
              {notice}
            </p>
          )}
        </>
      )}
    </SectionCard>
  )
}

export function ProfileEditForm({
  user,
  onSaved,
  onCancel,
}: {
  user: CurrentUser
  onSaved: () => void
  onCancel: () => void
}) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesOf(user),
  })
  const mutation = useUpdateProfile()
  const locale = useDictionaryLocale()
  const bio = useWatch({ control: form.control, name: "bio" })
  async function save(values: ProfileValues) {
    form.clearErrors()
    try {
      const updated = await mutation.mutateAsync(
        toUpdateProfileDto(values, user),
      )
      form.reset(valuesOf(updated))
      onSaved()
    } catch (error) {
      setProfileSaveError(form, error)
    }
  }
  return (
    <Form form={form} onSubmit={save} busy={mutation.isPending}>
      <fieldset disabled={mutation.isPending} className="min-w-0">
        <FieldGroup>
          <FormField
            name="displayName"
            label="Имя"
            placeholder="Как к вам обращаться"
            maxLength={100}
            autoComplete="name"
            required
          />
          <CaseCityField locale={locale} optional />
          <Field data-invalid={!!form.formState.errors.bio}>
            <FieldLabel htmlFor="profile-bio">О себе</FieldLabel>
            <Textarea
              id="profile-bio"
              defaultValue={user.bio ?? ""}
              {...form.register("bio")}
              maxLength={1000}
              rows={4}
              placeholder="Расскажите немного о себе и чем можете помочь"
              aria-invalid={!!form.formState.errors.bio}
              aria-describedby="bio-count bio-error"
            />
            <FieldDescription id="bio-count" className="text-right">
              {bio.length} / 1000
            </FieldDescription>
            <FieldError id="bio-error">
              {form.formState.errors.bio?.message}
            </FieldError>
          </Field>
        </FieldGroup>
      </fieldset>
      <FormAlert message={form.formState.errors.root?.message} />
      <LoadingButton
        type="submit"
        loading={mutation.isPending}
        loadingText="Сохраняем…"
        disabled={!form.formState.isDirty}
        className="w-full"
      >
        Сохранить изменения
      </LoadingButton>
      <Button
        type="button"
        variant="ghost"
        disabled={mutation.isPending}
        onClick={onCancel}
      >
        Отмена
      </Button>
    </Form>
  )
}
