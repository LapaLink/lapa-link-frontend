"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { ApiError } from "@/api"
import { useDeleteAccount } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { setFormError } from "@/lib/forms"
import {
  Form,
  FormField,
  FormAlert,
  LoadingButton,
  SectionCard,
} from "@/components/common"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldGroup,
} from "@/components/ui"
import { accountDeletionSchema, type AccountDeletionValues } from "../schemas"

const activeTaskLinks = [
  { href: ROUTES.MY_CASES, label: "Мои объявления", hint: "закройте открытые" },
  {
    href: `${ROUTES.MY_TASKS}#pending`,
    label: "Мои отклики",
    hint: "отмените ожидающие ответа",
  },
  {
    href: `${ROUTES.MY_TASKS}#active`,
    label: "Мои назначения",
    hint: "завершите или отмените активные",
  },
]

export function DeleteAccountCard() {
  const form = useForm<AccountDeletionValues>({
    resolver: zodResolver(accountDeletionSchema),
    defaultValues: { password: "" },
  })
  const password = useWatch({ control: form.control, name: "password" })
  const remove = useDeleteAccount()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Message of 409 ACCOUNT_HAS_ACTIVE_TASKS, shown with links to the sections.
  const [activeTasks, setActiveTasks] = useState("")
  // isPending lags behind a fast double click, so guard synchronously.
  const submitting = useRef(false)

  function handleOpenChange(next: boolean) {
    if (remove.isPending) return
    if (!next) {
      form.reset()
      setActiveTasks("")
    }
    setOpen(next)
  }

  async function submit(values: AccountDeletionValues) {
    if (submitting.current) return
    submitting.current = true
    form.clearErrors()
    setActiveTasks("")
    try {
      await remove.mutateAsync(values)
    } catch (error) {
      submitting.current = false
      if (error instanceof ApiError && error.code === "WRONG_PASSWORD") {
        form.setError(
          "password",
          { type: "server", message: error.message },
          { shouldFocus: true },
        )
        return
      }
      if (
        error instanceof ApiError &&
        error.code === "ACCOUNT_HAS_ACTIVE_TASKS"
      ) {
        setActiveTasks(error.message)
        return
      }
      setFormError(form, error)
      return
    }
    // Replace the history entry so "Back" does not return to the account page.
    router.replace(ROUTES.LOGIN)
  }

  return (
    <SectionCard
      className="border-destructive/30 bg-destructive/[0.02]"
      tone="danger"
      icon={Trash2}
      title="Опасная зона"
      description="Удаление аккаунта необратимо. Восстановить данные будет нельзя."
    >
      <Button
        variant="destructive"
        className="h-11 self-start sm:h-10"
        onClick={() => handleOpenChange(true)}
      >
        <Trash2 data-icon="inline-start" />
        Удалить аккаунт
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить аккаунт навсегда?</DialogTitle>
            <DialogDescription>
              Это действие необратимо. Вместе с аккаунтом будут удалены профиль,
              аватар, все ваши объявления (включая закрытые) с откликами на них,
              ваши отклики и назначения, а также уведомления.
            </DialogDescription>
          </DialogHeader>
          <Form
            form={form}
            onSubmit={submit}
            busy={remove.isPending}
            className="gap-5"
          >
            <FormAlert message={form.formState.errors.root?.message} />
            {activeTasks && (
              <Alert variant="destructive">
                <AlertTitle>{activeTasks}</AlertTitle>
                <AlertDescription>
                  <p>Сначала закройте или завершите текущие дела:</p>
                  <ul className="list-disc pl-5">
                    {activeTaskLinks.map(({ href, label, hint }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="font-semibold underline underline-offset-3"
                        >
                          {label}
                        </Link>{" "}
                        — {hint}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <FormField
                name="password"
                label="Текущий пароль"
                type="password"
                autoComplete="current-password"
                placeholder="Введите текущий пароль"
                disabled={remove.isPending}
                required
              />
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={remove.isPending}
                onClick={() => handleOpenChange(false)}
              >
                Отмена
              </Button>
              <LoadingButton
                type="submit"
                variant="destructive"
                loading={remove.isPending}
                loadingText="Удаляем…"
                disabled={!password}
              >
                Удалить навсегда
              </LoadingButton>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
