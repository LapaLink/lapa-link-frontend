"use client"

import { useForm, useWatch } from "react-hook-form"
import { useState } from "react"
import { Pencil, MapPin } from "lucide-react"
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
} from "@/components/common"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  Textarea,
} from "@/components/ui"
import { profileSchema, type ProfileValues } from "../schemas"

function valuesOf(user: CurrentUser): ProfileValues {
  return {
    displayName: user.displayName,
    cityCode: user.cityCode ?? "__none",
    bio: user.bio ?? "",
  }
}

export function ProfileCard({ user }: { user: CurrentUser }) {
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useTransientNotice()
  const cities = useCities()
  const locale = useDictionaryLocale()
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Личные данные</CardTitle>
        <CardDescription>
          {editing
            ? "Обновите информацию о себе."
            : "Познакомимся поближе. Здесь то, что вы рассказали о себе."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
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
            <dl className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <dt className="text-sm text-muted-foreground">Имя</dt>
                <dd className="text-lg font-semibold [overflow-wrap:anywhere]">
                  {user.displayName}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm text-muted-foreground">Город</dt>
                <dd className="flex items-center gap-2 [overflow-wrap:anywhere]">
                  <MapPin
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {user.cityCode
                    ? getCityName(cities.data, user.cityCode, locale)
                    : "Город не указан"}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <dt className="text-sm text-muted-foreground">О себе</dt>
                <dd className="max-h-64 overflow-y-auto overscroll-contain whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                  {user.bio?.trim()
                    ? user.bio
                    : "Расскажите немного о себе и чем можете помочь животным."}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
      {!editing && (
        <div className="flex flex-col gap-3 px-4">
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNotice("")
              setEditing(true)
            }}
            className="w-full"
          >
            <Pencil data-icon="inline-start" />
            Редактировать
          </Button>
        </div>
      )}
    </Card>
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
      const updated = await mutation.mutateAsync({
        displayName: values.displayName,
        cityCode: values.cityCode === "__none" ? null : values.cityCode,
        bio: values.bio.trim() ? values.bio : null,
      })
      form.reset(valuesOf(updated))
      onSaved()
    } catch (error) {
      if (error instanceof ApiError && error.code === "UNKNOWN_CITY") {
        form.setError("cityCode", { message: error.message })
      } else {
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
