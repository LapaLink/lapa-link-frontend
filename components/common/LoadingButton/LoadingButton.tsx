import type { ComponentProps } from "react"
import { Button } from "@/components/ui"
import { Loader } from "../Loader/Loader"

type LoadingButtonProps = ComponentProps<typeof Button> & {
  loading: boolean
  loadingText: string
}

export function LoadingButton({
  loading,
  loadingText,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button {...props} disabled={loading || disabled}>
      {loading ? <Loader label={loadingText} /> : children}
    </Button>
  )
}
