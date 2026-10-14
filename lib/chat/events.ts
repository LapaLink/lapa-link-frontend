import { z } from "zod"

export const CHAT_MESSAGE_MAX_LENGTH = 2000

export const chatMessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  clientMessageId: z.uuid(),
  text: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  createdAt: z.string(),
})

export const chatErrorSchema = z.object({
  conversationId: z.uuid(),
  clientMessageId: z.uuid().nullable(),
  error: z.string(),
  message: z.string(),
})

export const conversationSchema = z.object({
  id: z.uuid(),
  targetType: z.literal("CASE"),
  targetId: z.uuid(),
  targetTitle: z.string(),
  status: z.enum(["REQUESTED", "ACTIVE", "DECLINED"]),
  participants: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      role: z.enum(["OWNER", "INITIATOR"]),
    }),
  ),
  writable: z.boolean(),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
})

export const unreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
})

/** Parses a STOMP frame body; returns null for malformed JSON or payloads. */
export function parseFrame<T>(schema: z.ZodType<T>, body: string): T | null {
  try {
    const result = schema.safeParse(JSON.parse(body))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
