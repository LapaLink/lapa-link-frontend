"use client"

import { useState } from "react"
import { Flag } from "lucide-react"
import { ComplaintDialog } from "@/components/common"
import { Button } from "@/components/ui"

export function ReportCaseButton({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        className="h-11 w-full text-muted-foreground sm:h-10 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        <Flag aria-hidden />
        Пожаловаться
      </Button>
      <ComplaintDialog
        open={open}
        onOpenChange={setOpen}
        targetType="CASE"
        targetId={caseId}
        title="Пожаловаться на объявление"
        description="Модератор проверит объявление. Автор не узнает, кто отправил жалобу."
        placeholder="Например: животное продают, а не ищут ему дом."
        emptyMessage="Опишите, что не так с объявлением."
      />
    </>
  )
}
