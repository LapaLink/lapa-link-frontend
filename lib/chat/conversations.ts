import type { Conversation, PageResponse } from "@/types"

const activity = (conversation: Conversation) =>
  Date.parse(conversation.lastMessageAt ?? conversation.createdAt)

/**
 * Replaces a pushed conversation in a loaded list page and keeps the page
 * sorted by last activity, newest first. Returns the same page when the
 * conversation is not on it.
 */
export function mergeConversation(
  page: PageResponse<Conversation> | undefined,
  conversation: Conversation,
) {
  if (!page?.content.some((item) => item.id === conversation.id)) return page
  return {
    ...page,
    content: page.content
      .map((item) => (item.id === conversation.id ? conversation : item))
      .sort((a, b) => activity(b) - activity(a)),
  }
}
