"use client"

import { ImageCropDialog } from "@/components/common"

export function AvatarCropDialog(props: {
  file: File
  onClose: () => void
  onSave: (file: File) => Promise<void>
}) {
  return (
    <ImageCropDialog
      {...props}
      shape="round"
      onReturnFocus={() =>
        document
          .querySelector<HTMLButtonElement>("[data-avatar-upload]")
          ?.focus()
      }
    />
  )
}
