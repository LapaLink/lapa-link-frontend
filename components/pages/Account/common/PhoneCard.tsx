"use client"

import { useRef, useState } from "react"
import { Phone, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { ApiError, getErrorMessage } from "@/api"
import { useConfirmPhone, useCooldown, useRequestPhoneCode } from "@/hooks"
import type { CurrentUser } from "@/types"
import { LoadingButton, SectionCard, StatusBadge } from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui"
import { isValidPhone, normalizePhone } from "../schemas"

const CODE_LENGTH = 6

// Texts for the code field by error; rate limits show the server message.
const codeErrors: Record<string, string> = {
  OTP_INVALID: "Неверный код",
  OTP_EXPIRED: "Код устарел, запросите новый",
  OTP_ATTEMPTS_EXCEEDED: "Слишком много попыток, запросите новый код",
  PHONE_CONFIRMATION_OUTDATED: "Номер был изменён, запросите код заново",
}

/**
 * «Телефон» of the profile: the number with its confirmation status, and the
 * SMS flow — enter the number (POST /account/phone), then the 6-digit code
 * (POST /account/phone/confirm). Checking the code is the backend's job.
 */
export function PhoneCard({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [phone, setPhone] = useState("")
  const [requestId, setRequestId] = useState("")
  const [code, setCode] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [codeError, setCodeError] = useState("")
  const request = useRequestPhoneCode()
  const confirm = useConfirmPhone()
  const { secondsLeft: wait, start: startCooldown } = useCooldown()
  // State lags behind a fast double click, so guard synchronously.
  const busy = useRef(false)
  const pending = request.isPending || confirm.isPending
  const confirmed = !!user.phone && user.phoneConfirmed === true

  /** Sends a code and shows the code step; returns false on failure. */
  async function sendCode(number: string, from: "phone" | "code") {
    if (busy.current) return false
    busy.current = true
    try {
      const sent = await request.mutateAsync(number)
      setRequestId(sent.requestId)
      setCode("")
      setCodeError("")
      startCooldown(sent.resendAvailableInSeconds)
      setStep("code")
      return true
    } catch (error) {
      const message = getErrorMessage(error, "Не удалось отправить код.")
      if (
        error instanceof ApiError &&
        error.code === "PHONE_ALREADY_CONFIRMED"
      ) {
        // Nothing left to confirm: the refreshed user shows the badge.
        setOpen(false)
        return false
      }
      if (from === "phone") setPhoneError(message)
      else setCodeError(message)
      return false
    } finally {
      busy.current = false
    }
  }

  function openFlow(initial: string, send: boolean) {
    setPhone(initial)
    setPhoneError("")
    setCodeError("")
    setStep("phone")
    setOpen(true)
    // "Подтвердить": the saved number goes straight to the code step.
    if (send) void sendCode(normalizePhone(initial), "phone")
  }

  async function submitPhone() {
    const number = normalizePhone(phone)
    if (!number || !isValidPhone(number))
      return setPhoneError(
        "Введите номер в формате +375291234567: от 7 до 15 цифр.",
      )
    setPhoneError("")
    await sendCode(number, "phone")
  }

  async function submitCode(value = code) {
    if (busy.current || value.length !== CODE_LENGTH) return
    busy.current = true
    setCodeError("")
    try {
      await confirm.mutateAsync({ requestId, code: value })
      setOpen(false)
      toast.success("Телефон подтверждён")
    } catch (error) {
      const known = error instanceof ApiError && codeErrors[error.code ?? ""]
      setCodeError(
        known || getErrorMessage(error, "Не удалось подтвердить номер."),
      )
      if (error instanceof ApiError && error.code === "OTP_INVALID") setCode("")
    } finally {
      busy.current = false
    }
  }

  return (
    <SectionCard
      icon={Phone}
      title="Телефон"
      description="Нужен для связи с администрацией. Другие пользователи его не видят."
      fullWidthBody
    >
      {user.phone ? (
        <p className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Номер телефона: </span>
          <span className="font-medium">{user.phone}</span>
          <StatusBadge tone={confirmed ? "success" : "muted"}>
            {confirmed ? "Подтверждён" : "Не подтверждён"}
          </StatusBadge>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Номер не указан.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!user.phone ? (
          <Button className="h-11 sm:h-10" onClick={() => openFlow("", false)}>
            <Plus aria-hidden />
            Добавить телефон
          </Button>
        ) : (
          <>
            {!confirmed && (
              <Button
                className="h-11 sm:h-10"
                onClick={() => openFlow(user.phone ?? "", true)}
              >
                Подтвердить
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 sm:h-10"
              onClick={() => openFlow(user.phone ?? "", false)}
            >
              <Pencil aria-hidden />
              Изменить
            </Button>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          {step === "phone" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {user.phone ? "Изменить телефон" : "Добавить телефон"}
                </DialogTitle>
                <DialogDescription>
                  Отправим SMS с шестизначным кодом.
                </DialogDescription>
              </DialogHeader>
              <Field data-invalid={!!phoneError}>
                <FieldLabel htmlFor="phone-number">Номер телефона</FieldLabel>
                <Input
                  id="phone-number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  maxLength={25}
                  placeholder="+375291234567"
                  value={phone}
                  aria-invalid={!!phoneError}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitPhone()
                  }}
                />
                <FieldDescription>
                  От 7 до 15 цифр, можно с «+» в начале.
                </FieldDescription>
                <FieldError>{phoneError}</FieldError>
              </Field>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Отмена
                </Button>
                <LoadingButton
                  loading={request.isPending}
                  loadingText="Отправляем…"
                  onClick={() => void submitPhone()}
                >
                  Получить код
                </LoadingButton>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Введите код из SMS</DialogTitle>
                <DialogDescription>
                  Код отправлен на {normalizePhone(phone)}.
                </DialogDescription>
              </DialogHeader>
              <Field data-invalid={!!codeError}>
                <FieldLabel htmlFor="phone-code">Код</FieldLabel>
                <InputOTP
                  id="phone-code"
                  maxLength={CODE_LENGTH}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  disabled={pending}
                  aria-invalid={!!codeError}
                  onChange={(value) => setCode(value.replace(/\D/g, ""))}
                  onComplete={(value) => void submitCode(value)}
                >
                  <InputOTPGroup>
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldError>{codeError}</FieldError>
              </Field>
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                disabled={wait > 0 || pending}
                onClick={() => void sendCode(normalizePhone(phone), "code")}
              >
                {wait > 0
                  ? `Отправить код ещё раз через ${wait} с`
                  : "Отправить код ещё раз"}
              </Button>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStep("phone")}
                >
                  Изменить номер
                </Button>
                <LoadingButton
                  loading={confirm.isPending}
                  loadingText="Проверяем…"
                  disabled={code.length !== CODE_LENGTH}
                  onClick={() => void submitCode()}
                >
                  Подтвердить
                </LoadingButton>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
