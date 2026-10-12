"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/api"
import type {
  LoginDto,
  PasswordResetDto,
  RegistrationCompleteDto,
} from "@/types"
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

/** Finishes registration by confirmation token and signs in with the returned tokens. */
export function useCompleteRegistration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (values: RegistrationCompleteDto) =>
      completeSignIn(client, await authApi.completeRegistration(values)),
  })
}

export function useConfirmOtp() {
  return useMutation({ mutationFn: authApi.confirmOtp })
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword })
}

/** Sets a new password by confirmation token; the server revokes all sessions, so local tokens are dropped too. */
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
