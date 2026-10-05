"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@/api"
import {
  useRequestEmailChange,
  useConfirmEmailChange,
  useCountdown,
  useCooldown,
  useTransientNotice,
} from "@/hooks"
import { setFormError } from "@/lib/forms"
import type { OtpResponse } from "@/types"
import {
  emailChangeSchema,
  emailConfirmationSchema,
  type EmailChangeValues,
  type EmailConfirmationValues,
} from "../schemas"

type PendingEmailChange = OtpResponse & {
  email: string
  expiresAt: number
  resendAt: number
}

export function useEmailChange() {
  const requestForm = useForm<EmailChangeValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { newEmail: "", password: "" },
  })
  const codeForm = useForm<EmailConfirmationValues>({
    resolver: zodResolver(emailConfirmationSchema),
    defaultValues: { code: "" },
  })
  const request = useRequestEmailChange()
  const confirm = useConfirmEmailChange()
  // Credentials only live in this mounted component so resend can repeat step 1.
  const [credentials, setCredentials] = useState<EmailChangeValues | null>(null)
  const [pending, setPending] = useState<PendingEmailChange | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [codeUnavailable, setCodeUnavailable] = useState(false)
  const [notice, setNotice] = useTransientNotice()
  const expires = useCountdown(pending?.expiresAt || 0)
  const resendWait = useCountdown(pending?.resendAt || 0)
  const cooldown = useCooldown()
  const wait = Math.max(resendWait, cooldown.secondsLeft)
  const busy =
    request.isPending ||
    confirm.isPending ||
    requestForm.formState.isSubmitting ||
    codeForm.formState.isSubmitting

  useEffect(() => {
    if (
      pending &&
      !busy &&
      !blocked &&
      !codeUnavailable &&
      pending.expiresAt > Date.now()
    )
      codeForm.setFocus("code")
  }, [pending, busy, blocked, codeUnavailable, codeForm])

  function returnToRequest() {
    requestForm.reset({
      newEmail: pending?.email || requestForm.getValues("newEmail"),
      password: "",
    })
    codeForm.reset()
    setCredentials(null)
    setPending(null)
    setCodeUnavailable(false)
    setNotice("")
  }

  function handleLimit(error: ApiError) {
    if (error.code === "OTP_DAILY_LIMIT_EXCEEDED") setBlocked(true)
    if (error.code === "OTP_RESEND_TOO_OFTEN" || error.retryAfterSeconds) {
      const seconds =
        error.retryAfterSeconds ?? pending?.resendAvailableInSeconds
      if (seconds) cooldown.start(seconds)
    }
  }

  async function sendCode(values: EmailChangeValues) {
    if (blocked || wait > 0 || request.isPending || confirm.isPending) return
    requestForm.clearErrors()
    codeForm.clearErrors()
    setNotice("")
    try {
      const response = await request.mutateAsync(values)
      const now = Date.now()
      setCredentials(values)
      setPending({
        ...response,
        email: values.newEmail,
        expiresAt: now + response.expiresInSeconds * 1000,
        resendAt: now + response.resendAvailableInSeconds * 1000,
      })
      setCodeUnavailable(false)
      requestForm.reset({ newEmail: values.newEmail, password: "" })
      codeForm.reset()
      if (pending) setNotice("Отправили новое письмо. Введите код из него.")
    } catch (error) {
      if (error instanceof ApiError) {
        handleLimit(error)
        if (pending && (error.fields.newEmail || error.fields.password)) {
          returnToRequest()
          setFormError(requestForm, error)
          return
        }
        if (
          ["WRONG_PASSWORD", "EMAIL_UNCHANGED", "EMAIL_ALREADY_TAKEN"].includes(
            error.code || "",
          )
        ) {
          if (pending) returnToRequest()
          const field =
            error.code === "WRONG_PASSWORD" ? "password" : "newEmail"
          requestForm.setError(
            field,
            { type: "server", message: error.message },
            { shouldFocus: true },
          )
          return
        }
      }
      if (pending) setFormError(codeForm, error)
      else setFormError(requestForm, error)
    } finally {
      request.reset()
    }
  }

  async function confirmCode({ code }: EmailConfirmationValues) {
    if (
      !pending ||
      blocked ||
      codeUnavailable ||
      expires === 0 ||
      confirm.isPending ||
      request.isPending
    )
      return
    codeForm.clearErrors()
    setNotice("")
    try {
      await confirm.mutateAsync({
        requestId: pending.requestId,
        code,
        newEmail: pending.email,
      })
      setCredentials(null)
      setPending(null)
      codeForm.reset()
      requestForm.reset({ newEmail: "", password: "" })
      setNotice("Email изменён")
    } catch (error) {
      if (error instanceof ApiError) {
        handleLimit(error)
        if (error.code === "EMAIL_ALREADY_TAKEN") {
          returnToRequest()
          requestForm.setError(
            "newEmail",
            { type: "server", message: error.message },
            { shouldFocus: true },
          )
          return
        }
        if (error.code === "OTP_INVALID") {
          codeForm.setError(
            "code",
            { type: "server", message: error.message },
            { shouldFocus: true },
          )
          return
        }
        if (["OTP_EXPIRED", "OTP_ATTEMPTS_EXCEEDED"].includes(error.code || ""))
          setCodeUnavailable(true)
      }
      setFormError(codeForm, error)
    } finally {
      confirm.reset()
    }
  }

  async function resendCode() {
    if (!credentials || busy || wait > 0 || blocked) return
    await sendCode(credentials)
  }

  return {
    requestForm,
    codeForm,
    pending,
    busy,
    blocked,
    notice,
    expires,
    wait,
    codeDisabled: blocked || codeUnavailable || expires === 0,
    sendCode,
    confirmCode,
    resendCode,
    returnToRequest,
  }
}
