"use client"

import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/api"
import type { LoginDto, VerificationDto } from "@/types"
import { useAuth } from "./useAuth"

export function useLogin() {
  const { completeSignIn } = useAuth()
  return useMutation({
    mutationFn: async (values: LoginDto) =>
      completeSignIn(await authApi.login(values)),
  })
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useVerifyEmail() {
  const { completeSignIn } = useAuth()
  return useMutation({
    mutationFn: async (values: VerificationDto) =>
      completeSignIn(await authApi.verify(values)),
  })
}

export function useResendCode() {
  return useMutation({ mutationFn: authApi.resend })
}

export function useLogout() {
  const { logout } = useAuth()
  return useMutation({ mutationFn: logout })
}
