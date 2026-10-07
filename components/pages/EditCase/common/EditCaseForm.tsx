"use client"

import Link from "next/link"
import { useDictionaryLocale } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import {
  Form,
  FormField,
  FormAlert,
  LoadingButton,
  CaseSelectField,
  CaseTextField,
  CaseCityField,
  CaseAgeField,
} from "@/components/common"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  FieldGroup,
  SelectGroup,
  SelectItem,
} from "@/components/ui"
import type { CaseDetails } from "@/types"
import { useEditCase } from "../hooks/useEditCase"

export function EditCaseForm({ item }: { item: CaseDetails }) {
  const { form, save } = useEditCase(item)
  const locale = useDictionaryLocale()
  return (
    <Form
      form={form}
      busy={save.isPending}
      onSubmit={(values) => {
        form.clearErrors()
        save.mutate(values)
      }}
    >
      {save.isSuccess && (
        <Alert role="status">
          <AlertDescription>
            Изменения сохранены. Информация в объявлении обновлена.
          </AlertDescription>
        </Alert>
      )}
      <fieldset
        disabled={save.isPending}
        className="flex min-w-0 flex-col gap-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>О животном</CardTitle>
            <CardDescription>
              Уточните информацию, чтобы людям было проще помочь.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormField
                name="title"
                label="Название"
                maxLength={150}
                required
                placeholder="Например, найден рыжий кот у парка"
              />
              <CaseTextField
                name="description"
                label="Описание"
                maxLength={2000}
                placeholder="Что известно о животном и месте находки"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <CaseSelectField
                  name="sex"
                  label="Пол"
                  placeholder="Выберите пол"
                >
                  <SelectGroup>
                    <SelectItem value="UNKNOWN">Неизвестно</SelectItem>
                    <SelectItem value="MALE">Самец</SelectItem>
                    <SelectItem value="FEMALE">Самка</SelectItem>
                  </SelectGroup>
                </CaseSelectField>
                <CaseAgeField />
              </div>
              <CaseTextField
                name="condition"
                label="Состояние"
                maxLength={500}
                placeholder="Как сейчас чувствует себя животное"
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Город</CardTitle>
            <CardDescription>Выберите город из справочника.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <CaseCityField locale={locale} />
            </FieldGroup>
          </CardContent>
        </Card>
        <FormAlert message={form.formState.errors.root?.message} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <LoadingButton
            type="submit"
            size="lg"
            className="sm:flex-1"
            loading={save.isPending}
            loadingText="Сохраняем…"
            disabled={!form.formState.isDirty}
          >
            Сохранить изменения
          </LoadingButton>
          <Button asChild variant="outline" size="lg">
            <Link href={ROUTES.CASE_DETAILS(item.id)}>
              {save.isSuccess ? "Вернуться к объявлению" : "Отмена"}
            </Link>
          </Button>
        </div>
      </fieldset>
    </Form>
  )
}
