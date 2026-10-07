"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { accountApi, ApiError } from "@/api"
import { getSessionRevision, readTokens, saveTokens } from "@/lib/auth"
import type {
  CurrentUser,
  EmailConfirmationDto,
  UserProfile,
  UpdateProfileDto,
} from "@/types"

import { ACCOUNT_QUERY_KEY } from "./model/accountQuery"

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateProfileDto) => {
      const revision = getSessionRevision()
      const user = await accountApi.updateProfile(data)
      if (revision !== getSessionRevision() || !readTokens())
        throw new ApiError("Сессия завершена. Войдите заново.", 401)
      await client.cancelQueries({ queryKey: ACCOUNT_QUERY_KEY })
      if (revision !== getSessionRevision() || !readTokens())
        throw new ApiError("Сессия завершена. Войдите заново.", 401)
      client.setQueriesData<CurrentUser>(
        { queryKey: ACCOUNT_QUERY_KEY },
        (current) => (current?.id === user.id ? user : current),
      )
      void client.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
      return user
    },
  })
}

function useAvatarMutation<T>(action: (value: T) => Promise<UserProfile>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (value: T) => {
      const revision = getSessionRevision()
      const profile = await action(value)
      if (revision !== getSessionRevision() || !readTokens()) return profile
      await client.cancelQueries({ queryKey: ACCOUNT_QUERY_KEY })
      if (revision !== getSessionRevision() || !readTokens()) return profile
      client.setQueriesData<CurrentUser>(
        { queryKey: ACCOUNT_QUERY_KEY },
        (current) =>
          current?.id === profile.userId
            ? { ...current, avatarUrl: profile.avatarUrl }
            : current,
      )
      return profile
    },
  })
}

export function useUploadAvatar() {
  return useAvatarMutation(accountApi.uploadAvatar)
}

export function useDeleteAvatar() {
  return useAvatarMutation(accountApi.deleteAvatar)
}

export function useRequestEmailChange() {
  return useMutation({ mutationFn: accountApi.requestEmailChange, gcTime: 0 })
}

type EmailConfirmation = EmailConfirmationDto & { newEmail: string }

export function useConfirmEmailChange() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: async ({ newEmail, ...confirmation }: EmailConfirmation) => {
      const revision = getSessionRevision()
      const tokens = await accountApi.confirmEmailChange(confirmation)
      if (revision !== getSessionRevision() || !readTokens())
        throw new ApiError("Сессия завершена. Войдите заново.", 401)
      // Replace both tokens before cancelling/refetching any account requests.
      saveTokens(tokens)
      await client.cancelQueries({ queryKey: ACCOUNT_QUERY_KEY })
      if (revision === getSessionRevision() && readTokens()) {
        client.setQueriesData<CurrentUser>(
          { queryKey: ACCOUNT_QUERY_KEY },
          (current) => (current ? { ...current, email: newEmail } : current),
        )
        void client.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY })
      }
      return tokens
    },
  })
}
