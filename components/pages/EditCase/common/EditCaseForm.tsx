"use client"

import Link from "next/link"
import { CircleCheck, MapPin, PawPrint } from "lucide-react"
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
  SectionCard,
} from "@/components/common"
import {
  Alert,
  AlertDescription,
  Button,
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
        <Alert
          role="status"
          className="border-success-foreground/20 bg-success text-success-foreground"
        >
          <CircleCheck aria-hidden />
          <AlertDescription className="text-success-foreground">
            Изменения сохранены. Информация в объявлении обновлена.
          </AlertDescription>
        </Alert>
      )}
      <fieldset
        disabled={save.isPending}
        className="flex min-w-0 flex-col gap-6"
      >
        <SectionCard
          icon={PawPrint}
          title="О животном"
          description="Уточните информацию, чтобы людям было проще помочь."
          fullWidthBody
        >
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
        </SectionCard>
        <SectionCard
          icon={MapPin}
          title="Город"
          description="Выберите город из справочника."
          fullWidthBody
        >
          <FieldGroup>
            <CaseCityField locale={locale} />
          </FieldGroup>
        </SectionCard>
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
