import { ArrowLeft } from "lucide-react"
import { LoadingButton } from "@/components/common"
import { Button } from "@/components/ui"

/**
 * "Назад / Пропустить / Далее" row under a step. With `submit` the main button
 * submits the surrounding form instead of calling `onNext`.
 */
export function StepActions({
  onBack,
  onSkip,
  onNext,
  submit = false,
  busy = false,
  nextLabel = "Далее",
}: {
  onBack?: () => void
  onSkip: () => void
  onNext?: () => void
  submit?: boolean
  busy?: boolean
  nextLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-5">
      {onBack && (
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-10"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden />
          Назад
        </Button>
      )}
      <span className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        className="h-11 text-muted-foreground sm:h-10"
        disabled={busy}
        onClick={onSkip}
      >
        Пропустить
      </Button>
      <LoadingButton
        type={submit ? "submit" : "button"}
        className="h-11 min-w-36 sm:h-10"
        loading={busy}
        loadingText="Сохраняем…"
        onClick={submit ? undefined : onNext}
      >
        {nextLabel}
      </LoadingButton>
    </div>
  )
}
