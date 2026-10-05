"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/api"
import type { LoginDto, VerificationDto } from "@/types"
import { completeSignIn, logoutSession } from "./model/sessionActions"

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

export function useLogout() {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => logoutSession(client) })
}
