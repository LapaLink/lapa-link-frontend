import { z } from "zod"

export const CHAT_MESSAGE_MAX_LENGTH = 2000

// The backend omits null fields from JSON, so a missing field means null.
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().default(null)

export const chatMessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  senderId: z.uuid(),
  clientMessageId: z.uuid(),
  // Null once the message is deleted.
  text: nullable(z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH)),
  createdAt: z.string(),
  editedAt: nullable(z.string()),
  deletedAt: nullable(z.string()),
})

export const chatTypingSchema = z.object({
  conversationId: z.uuid(),
  userId: z.uuid(),
  typing: z.boolean(),
})

export const chatErrorSchema = z.object({
  conversationId: z.uuid(),
  clientMessageId: nullable(z.uuid()),
  error: z.string(),
  message: z.string(),
})

export const conversationSchema = z.object({
  id: z.uuid(),
  targetType: z.literal("CASE"),
  targetId: z.uuid(),
  targetTitle: z.string(),
  status: z.enum(["REQUESTED", "ACTIVE", "DECLINED", "CLOSED"]),
  participants: z.array(
    z.object({
      userId: z.uuid(),
      displayName: z.string(),
      role: z.enum(["OWNER", "INITIATOR"]),
      lastReadAt: nullable(z.string()),
    }),
  ),
  writable: z.boolean(),
  unreadCount: z.number().int().nonnegative(),
  lastMessageAt: nullable(z.string()),
  createdAt: z.string(),
  closedAt: nullable(z.string()),
  closedBy: nullable(z.uuid()),
  hidden: z.boolean(),
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
