"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/api"
import type { LoginDto, PasswordResetDto, VerificationDto } from "@/types"
import {
  clearLocalSession,
  completeSignIn,
  logoutSession,
} from "./model/sessionActions"

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (values: LoginDto) =>
      completeSignIn(client, await authApi.login(values)),
  })
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useVerifyEmail() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (values: VerificationDto) =>
      completeSignIn(client, await authApi.verify(values)),
  })
}

export function useResendCode() {
  return useMutation({ mutationFn: authApi.resend })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword })
}

/** Resets the password by code; the server revokes all sessions, so local tokens are dropped too. */
export function useResetPassword() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (values: PasswordResetDto) => {
      await authApi.resetPassword(values)
      await clearLocalSession(client)
    },
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => logoutSession(client) })
}
