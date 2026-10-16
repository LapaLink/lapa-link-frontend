"use client"

import { useState } from "react"
import { cn } from "cn"
import { Check, HeartHandshake } from "lucide-react"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { NavigationLink as Link } from "@/components/providers"
import { IconCircle, RequireAuth } from "@/components/common"
import { Header } from "@/components/layouts"
import { NotificationSettings } from "../Account/common/NotificationsCard"
import { DoneStep } from "./common/DoneStep"
import { HelpOffersStep } from "./common/HelpOffersStep"
import { HomeAreaStep } from "./common/HomeAreaStep"
import { ProfileStep } from "./common/ProfileStep"
import { StepActions } from "./common/StepActions"
import { ONBOARDING_STEPS, type StepProps } from "./common/steps"

/**
 * Profile setup right after registration: one step at a time, each can be
 * skipped. "Далее" saves the step (notification switches save at once), so
 * leaving midway keeps everything done so far.
 */
export function Onboarding() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header>
        <Link
          href={ROUTES.HOME}
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Заполню позже
        </Link>
      </Header>
      <main
        id="main-content"
        className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
      >
        <RequireAuth guestMessage="Войдите, чтобы настроить профиль.">
          <OnboardingSteps />
        </RequireAuth>
      </main>
    </div>
  )
}

function OnboardingSteps() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set())
  if (!user) return null

  const open = (index: number) => {
    setStep(index)
    window.scrollTo({ top: 0 })
  }
  const leave = (skip: boolean) => () => {
    setSkipped((current) => {
      const next = new Set(current)
      if (skip) next.add(step)
      else next.delete(step)
      return next
    })
    open(step + 1)
  }
  const props: StepProps = {
    onNext: leave(false),
    onSkip: leave(true),
    onBack: step > 0 ? () => open(step - 1) : undefined,
  }

  if (step >= ONBOARDING_STEPS.length)
    return <DoneStep user={user} skipped={skipped} onOpenStep={open} />

  const current = ONBOARDING_STEPS[step]
  return (
    <>
      <section
        aria-label="Прогресс настройки"
        className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border bg-card p-5 sm:px-7"
      >
        <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-4">
          <IconCircle icon={HeartHandshake} />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">
              Добро пожаловать, {user.displayName}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Пара минут — и мы сможем присылать объявления, где нужна ваша
              помощь. Любой шаг можно пропустить и заполнить потом в профиле.
            </p>
          </div>
        </div>
        <Stepper step={step} skipped={skipped} />
      </section>

      <section
        aria-labelledby="onboarding-step"
        className="flex flex-wrap overflow-hidden rounded-2xl border bg-card"
      >
        <aside className="flex flex-[1_1_16rem] flex-col gap-3 bg-primary-soft/40 p-5 sm:p-7">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-xl font-extrabold text-primary"
          >
            {step + 1}
          </span>
          <h2
            id="onboarding-step"
            className="text-2xl font-extrabold tracking-tight"
          >
            {current.label}
          </h2>
          <p className="text-muted-foreground">{current.description}</p>
          <p className="mt-auto pt-2 text-sm font-semibold text-muted-foreground">
            Шаг {step + 1} из {ONBOARDING_STEPS.length}
          </p>
        </aside>
        <div className="flex min-w-0 flex-[999_1_30rem] flex-col gap-6 p-5 sm:p-7">
          {step === 0 && <ProfileStep user={user} {...props} />}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <NotificationSettings user={user} />
              <StepActions
                onBack={props.onBack}
                onSkip={props.onSkip}
                onNext={props.onNext}
              />
            </div>
          )}
          {step === 2 && <HelpOffersStep {...props} />}
          {step === 3 && <HomeAreaStep user={user} {...props} />}
        </div>
      </section>
    </>
  )
}

function Stepper({
  step,
  skipped,
}: {
  step: number
  skipped: ReadonlySet<number>
}) {
  return (
    <ol className="flex min-w-0 flex-[1_1_22rem]">
      {ONBOARDING_STEPS.map(({ label }, index) => {
        const current = index === step
        const done = index < step && !skipped.has(index)
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-1/2 h-0.5 w-full",
                  index <= step ? "bg-primary" : "bg-input",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative flex size-8.5 items-center justify-center rounded-full text-sm font-extrabold",
                current &&
                  "bg-primary text-primary-foreground ring-4 ring-primary-soft",
                done && "bg-primary-soft text-primary",
                !current &&
                  !done &&
                  "border-[1.5px] border-input bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-tight",
                current ? "font-extrabold text-primary" : "font-semibold",
                index > step && "text-muted-foreground",
              )}
            >
              {label}
              {done && <span className="sr-only"> — готово</span>}
              {index < step && skipped.has(index) && (
                <span className="sr-only"> — пропущено</span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
