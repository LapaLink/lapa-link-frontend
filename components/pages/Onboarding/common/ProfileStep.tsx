"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useDictionaryLocale, useUpdateProfile } from "@/hooks"
import type { CurrentUser } from "@/types"
import {
  CaseCityField,
  Form,
  FormAlert,
  FormField,
  TextAreaField,
} from "@/components/common"
import { FieldGroup } from "@/components/ui"
import { AvatarEditor } from "../../Account/common/AvatarEditor"
import { setProfileSaveError, valuesOf } from "../../Account/common/ProfileCard"
import {
  profileSchema,
  toUpdateProfileDto,
  type ProfileValues,
} from "../../Account/schemas"
import { StepActions } from "./StepActions"
import type { StepProps } from "./steps"

/** Photo (uploaded at once), name, city and bio; "Далее" saves the profile if it changed. */
export function ProfileStep({
  user,
  onNext,
  onSkip,
}: StepProps & { user: CurrentUser }) {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesOf(user),
  })
  const update = useUpdateProfile()
  const locale = useDictionaryLocale()

  async function save(values: ProfileValues) {
    form.clearErrors()
    if (!form.formState.isDirty) return onNext()
    try {
      await update.mutateAsync(toUpdateProfileDto(values, user))
      onNext()
    } catch (error) {
      setProfileSaveError(form, error)
    }
  }

  return (
    <Form form={form} onSubmit={save} busy={update.isPending}>
      <AvatarEditor user={user} />
      <fieldset disabled={update.isPending} className="min-w-0">
        <FieldGroup>
          <FormField
            name="displayName"
            label="Как к вам обращаться"
            description="Это имя увидят авторы объявлений."
            maxLength={100}
            autoComplete="name"
            required
          />
          <CaseCityField locale={locale} optional />
          <TextAreaField
            name="bio"
            label="О себе"
            placeholder="Например: есть машина, могу отвезти в клинику по выходным"
            maxLength={1000}
          />
        </FieldGroup>
      </fieldset>
      <FormAlert message={form.formState.errors.root?.message} />
      <StepActions onSkip={onSkip} submit busy={update.isPending} />
    </Form>
  )
}
