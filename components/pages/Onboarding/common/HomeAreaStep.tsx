"use client"

import { Info } from "lucide-react"
import type { CurrentUser } from "@/types"
import { HomeAreaPicker } from "../../Account/common/HomeAreaPicker"
import { useHomePoint } from "../../Account/hooks/useHomePoint"
import { StepActions } from "./StepActions"
import type { StepProps } from "./steps"

/** Inline map for the home point; "Завершить" saves it if it changed. */
export function HomeAreaStep({
  user,
  onNext,
  onBack,
  onSkip,
}: StepProps & { user: CurrentUser }) {
  const home = useHomePoint(user)

  async function finish() {
    if (!home.dirty || (await home.save())) onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {home.draft
          ? "Нажмите на карту, чтобы перенести точку."
          : "Нажмите на карту, чтобы поставить точку."}
      </p>
      <HomeAreaPicker user={user} home={home} />
      <p className="flex gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-hover">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {home.draft
          ? "Точку видите только вы. От неё считаем радиус, который вы указали для каждого вида помощи."
          : "Без точки подбираем объявления по городу из профиля, без учёта радиуса."}
      </p>
      <StepActions
        onBack={onBack}
        onSkip={onSkip}
        onNext={() => void finish()}
        busy={home.saving}
        nextLabel="Завершить"
      />
    </div>
  )
}
