"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { accountApi, ApiError } from "@/api"
import { getSessionRevision, readTokens, saveTokens } from "@/lib/auth"
import { queryKeys } from "@/lib/queryKeys"
import type {
  CurrentUser,
  EmailConfirmationDto,
  NotificationSetting,
  PasswordChangeDto,
  UserLocale,
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

/** Changes the password and keeps this device signed in with the returned tokens. */
export function useChangePassword() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (data: PasswordChangeDto) => {
      const revision = getSessionRevision()
      const tokens = await accountApi.changePassword(data)
      if (revision !== getSessionRevision() || !readTokens())
        throw new ApiError("Сессия завершена. Войдите заново.", 401)
      // Old tokens are revoked by the backend, so replace both right away.
      saveTokens(tokens)
      return tokens
    },
  })
}

/** Saves the account language and applies it to the cached current user. */
export function useUpdateLocale() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (locale: UserLocale) => {
      const revision = getSessionRevision()
      await accountApi.updateLocale(locale)
      if (revision !== getSessionRevision() || !readTokens()) return locale
      await client.cancelQueries({ queryKey: ACCOUNT_QUERY_KEY })
      client.setQueriesData<CurrentUser>(
        { queryKey: ACCOUNT_QUERY_KEY },
        (current) => (current ? { ...current, locale } : current),
      )
      return locale
    },
  })
}

/** Toggles one notification setting optimistically and rolls back on error. */
export function useUpdateNotification() {
  const client = useQueryClient()
  const apply = (setting: NotificationSetting) =>
    client.setQueryData<NotificationSetting[]>(
      queryKeys.notifications,
      (current) =>
        current?.map((item) =>
          item.eventType === setting.eventType &&
          item.channel === setting.channel
            ? setting
            : item,
        ),
    )
  return useMutation({
    mutationFn: accountApi.updateNotification,
    onMutate: async (setting) => {
      await client.cancelQueries({ queryKey: queryKeys.notifications })
      apply(setting)
    },
    onSuccess: apply,
    onError: (_error, setting) =>
      apply({ ...setting, enabled: !setting.enabled }),
  })
}
