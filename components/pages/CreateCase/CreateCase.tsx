"use client"

import { useAuth, useCities, useNeedTypes } from "@/hooks"
import { resolveDictionaryLocale } from "@/lib/dictionaries"
import {
  Form,
  FormAlert,
  LoadingButton,
  RequireAuth,
} from "@/components/common"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  FieldGroup,
} from "@/components/ui"
import { useCreateCase } from "./hooks/useCreateCase"
import {
  AnimalFields,
  CityField,
  PhotoField,
  NeedTypesField,
  PublicationResult,
} from "./common"

export function CreateCase() {
  return (
    <RequireAuth>
      <CreateCaseContent />
    </RequireAuth>
  )
}

function CreateCaseContent() {
  const { user } = useAuth()
  const cities = useCities()
  const types = useNeedTypes()
  const locale = resolveDictionaryLocale(user?.locale)
  const publication = useCreateCase()
  const { form, busy } = publication
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8">
      {publication.created ? (
        <PublicationResult
          animalCase={publication.created}
          cities={cities.data}
          types={types.data}
          locale={locale}
          pendingTypes={publication.pendingTypes}
          finished={publication.finished}
          busy={busy}
          error={publication.publicationError}
          onRetry={() => void publication.submit(null)}
          onCreateAnother={publication.startAgain}
          onSkipType={publication.skipType}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-primary">
              Поможем найти заботу и дом
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Вы нашли животное?
            </h1>
            <p className="text-muted-foreground">
              Расскажите о нём и укажите, какая помощь нужна. Для публикации
              достаточно типа животного, заголовка и города.
            </p>
          </div>
          <Form
            form={form}
            busy={busy}
            onSubmit={(values) => publication.submit(values)}
          >
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>О животном</h2>
                  </CardTitle>
                  <CardDescription>
                    Тип животного и заголовок обязательны.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <AnimalFields />
                    <PhotoField />
                  </FieldGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>Место находки</h2>
                  </CardTitle>
                  <CardDescription>
                    Выберите город — это обязательное поле.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CityField locale={locale} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>Помощь рядом</h2>
                  </CardTitle>
                  <CardDescription>
                    Люди смогут понять, чем помочь животному.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NeedTypesField locale={locale} />
                </CardContent>
              </Card>
              <FormAlert message={form.formState.errors.root?.message} />
              <LoadingButton
                type="submit"
                size="lg"
                loading={busy}
                loadingText="Публикуем…"
                disabled={!!form.formState.errors.photo}
              >
                Опубликовать объявление
              </LoadingButton>
            </fieldset>
          </Form>
        </>
      )}
    </section>
  )
}
