import type { ComponentProps } from "react"
import { LoadingButton } from "../LoadingButton/LoadingButton"

type ResendCodeButtonProps = Pick<
  ComponentProps<typeof LoadingButton>,
  "onClick" | "disabled" | "size"
> & {
  wait: number
  loading?: boolean
}

export function ResendCodeButton({
  wait,
  loading = false,
  disabled,
  size = "lg",
  onClick,
}: ResendCodeButtonProps) {
  return (
    <LoadingButton
      type="button"
      variant="outline"
      size={size}
      loading={loading}
      loadingText="Отправляем…"
      disabled={disabled || wait > 0}
      onClick={onClick}
    >
      {wait > 0 ? `Отправить ещё раз через ${wait} с` : "Отправить код ещё раз"}
    </LoadingButton>
  )
}
