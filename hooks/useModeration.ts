"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, moderationApi } from "@/api"
import { getSessionRevision, readTokens } from "@/lib/auth"
import { queryKeys } from "@/lib/queryKeys"
import type { ModerationAction, ModerationReport } from "@/types"

export function useModerationAction(
  reportId: string,
  target?: Pick<ModerationReport, "targetType" | "targetId">,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      action,
      comment,
      userId,
    }: {
      action: ModerationAction | "block-user"
      comment?: string
      userId?: string
    }) => {
      const revision = getSessionRevision()
      try {
        if (action === "block-user") {
          if (!userId || !comment)
            throw new ApiError(
              "Укажите пользователя и причину блокировки.",
              400,
            )
          await moderationApi.blockUser(userId, comment)
        } else await moderationApi.act(reportId, action, comment)
      } finally {
        if (revision === getSessionRevision() && readTokens())
          await Promise.all([
            client.invalidateQueries({ queryKey: queryKeys.moderation }),
            client.invalidateQueries({ queryKey: ["account", "complaints"] }),
            client.invalidateQueries({ queryKey: queryKeys.casesList }),
            client.invalidateQueries({ queryKey: ["account", "cases"] }),
            ...(target?.targetType === "CASE"
              ? [
                  client.invalidateQueries({
                    queryKey: queryKeys.caseDetail(target.targetId),
                  }),
                  client.invalidateQueries({
                    queryKey: queryKeys.caseResponses(target.targetId),
                  }),
                  client.invalidateQueries({
                    queryKey: queryKeys.caseHistory(target.targetId),
                  }),
                  client.invalidateQueries({
                    queryKey: queryKeys.chatPermission("CASE", target.targetId),
                  }),
                ]
              : []),
            ...(target?.targetType === "CONVERSATION"
              ? [
                  client.invalidateQueries({
                    queryKey: queryKeys.conversation(target.targetId),
                  }),
                  client.invalidateQueries({
                    queryKey: queryKeys.conversationLists,
                  }),
                ]
              : []),
          ])
      }
    },
  })
}
