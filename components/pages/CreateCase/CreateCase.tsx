"use client"

import { useRef, useState } from "react"
import { useAuth, useCities, useNeedTypes } from "@/hooks"
import { resolveDictionaryLocale } from "@/lib/dictionaries"
import {
  Form,
  FormAlert,
  LoadingButton,
  RequireAuth,
} from "@/components/common"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui"
import { useCreateCase } from "./hooks/useCreateCase"
import { CREATE_CASE_STEPS, firstInvalidStep } from "./steps"
import {
  AnimalDetailsFields,
  AnimalFields,
  CityField,
  PhotoField,
  NeedTypesField,
  PublicationResult,
} from "./common"

export function CreateCase() {
  return (
    <RequireAuth guestMessage="Войдите, чтобы подать объявление о найденном животном. Так откликнувшиеся смогут связаться именно с вами.">
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
  const [step, setStep] = useState(0)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const current = CREATE_CASE_STEPS[step]
  const lastStep = step === CREATE_CASE_STEPS.length - 1

  function goTo(index: number) {
    setStep(index)
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => stepHeading.current?.focus())
  }

  async function goNext() {
    if (await form.trigger(current.fields, { shouldFocus: true }))
      goTo(step + 1)
  }

  function showFirstError() {
    const index = firstInvalidStep((field) => form.getFieldState(field).invalid)
    if (index !== -1 && index !== step) goTo(index)
  }

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
          onCreateAnother={() => {
            publication.startAgain()
            setStep(0)
          }}
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
            {step === 0 && (
              <p className="text-muted-foreground">
                Расскажите о нём и укажите, какая помощь нужна. Для публикации
                достаточно типа животного, заголовка и города.
              </p>
            )}
          </div>
          <Form
            form={form}
            busy={busy}
            onSubmit={async (values) => {
              await publication.submit(values)
              showFirstError()
            }}
            onInvalid={showFirstError}
            onKeyDown={(event) => {
              // Enter in a text input moves to the next step instead of publishing.
              if (
                event.key === "Enter" &&
                !lastStep &&
                !event.defaultPrevented &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault()
                void goNext()
              }
            }}
          >
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <p className="text-sm text-muted-foreground">
                    Шаг {step + 1} из {CREATE_CASE_STEPS.length}
                  </p>
                  <div className="flex gap-1.5" aria-hidden>
                    {CREATE_CASE_STEPS.map((item, index) => (
                      <span
                        key={item.title}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          index <= step ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <CardTitle>
                    <h2
                      ref={stepHeading}
                      tabIndex={-1}
                      className="outline-none"
                    >
                      {current.title}
                    </h2>
                  </CardTitle>
                  <CardDescription>{current.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {step === 0 && <AnimalFields />}
                  {step === 1 && <AnimalDetailsFields />}
                  {step === 2 && <PhotoField />}
                  {step === 3 && <CityField locale={locale} />}
                  {step === 4 && <NeedTypesField locale={locale} />}
                </CardContent>
              </Card>
              <FormAlert message={form.formState.errors.root?.message} />
              <div className="flex gap-3">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => goTo(step - 1)}
                  >
                    Назад
                  </Button>
                )}
                {lastStep ? (
                  <LoadingButton
                    type="submit"
                    size="lg"
                    className="flex-1"
                    loading={busy}
                    loadingText="Публикуем…"
                    disabled={!!form.formState.errors.photo}
                  >
                    Опубликовать
                  </LoadingButton>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1"
                    disabled={!!form.formState.errors.photo}
                    onClick={() => void goNext()}
                  >
                    Далее
                  </Button>
                )}
              </div>
            </fieldset>
          </Form>
        </>
      )}
    </section>
  )
}
