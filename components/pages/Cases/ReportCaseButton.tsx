"use client"

import { useState } from "react"
import { Flag } from "lucide-react"
import { ComplaintDialog } from "@/components/common"
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui"

export function ReportCaseButton({
  caseId,
  authorId,
}: {
  caseId: string
  authorId?: string
}) {
  const [target, setTarget] = useState<"CASE" | "USER" | null>(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-11 w-full text-muted-foreground sm:h-10 sm:w-fit"
          >
            <Flag aria-hidden />
            Пожаловаться
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setTarget("CASE")}>
              На объявление
            </DropdownMenuItem>
            {authorId && (
              <DropdownMenuItem onSelect={() => setTarget("USER")}>
                На автора объявления
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComplaintDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        targetType={target ?? "CASE"}
        targetId={target === "USER" ? authorId! : caseId}
        title={
          target === "USER"
            ? "Пожаловаться на пользователя"
            : "Пожаловаться на объявление"
        }
        description={
          target === "USER"
            ? "Опишите поведение пользователя. Жалоба будет доступна модератору."
            : "Модератор проверит объявление. Автор не узнает, кто отправил жалобу."
        }
        placeholder={
          target === "USER"
            ? "Расскажите, что произошло."
            : "Например: животное продают, а не ищут ему дом."
        }
        emptyMessage="Опишите причину жалобы."
      />
    </>
  )
}
