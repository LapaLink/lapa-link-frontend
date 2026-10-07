"use client"

import { FormField, CaseAgeField } from "@/components/common"
import { FieldGroup, SelectGroup, SelectItem } from "@/components/ui"
import { CaseTextField } from "./CaseTextField"
import { CaseSelectField } from "./CaseSelectField"

export function AnimalFields() {
  return (
    <FieldGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <CaseSelectField
          name="animalType"
          label="Кого нашли?"
          placeholder="Выберите животное"
        >
          <SelectGroup>
            <SelectItem value="CAT">Кошку</SelectItem>
            <SelectItem value="DOG">Собаку</SelectItem>
          </SelectGroup>
        </CaseSelectField>
        <CaseSelectField name="sex" label="Пол" placeholder="Выберите пол">
          <SelectGroup>
            <SelectItem value="UNKNOWN">Неизвестно</SelectItem>
            <SelectItem value="MALE">Самец</SelectItem>
            <SelectItem value="FEMALE">Самка</SelectItem>
          </SelectGroup>
        </CaseSelectField>
      </div>
      <FormField
        name="title"
        label="Заголовок"
        placeholder="Например, найден рыжий кот у метро"
        maxLength={150}
        required
      />
      <CaseTextField
        name="description"
        label="Что произошло?"
        placeholder="Расскажите, где нашли животное и что о нём известно"
        maxLength={2000}
      />
      <CaseAgeField />
      <CaseTextField
        name="condition"
        label="Состояние животного"
        placeholder="Например, напуган, хромает или выглядит здоровым"
        maxLength={500}
      />
    </FieldGroup>
  )
}
