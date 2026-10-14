import type { Conversation, PageResponse } from "@/types"

const activity = (conversation: Conversation) =>
  Date.parse(conversation.lastMessageAt ?? conversation.createdAt)

/**
 * Replaces a pushed conversation in a loaded list page and keeps the page
 * sorted by last activity, newest first. When the list is filtered by
 * `hidden` and the conversation no longer matches, it is removed instead.
 * Returns the same page when the conversation is not on it.
 */
export function mergeConversation(
  page: PageResponse<Conversation> | undefined,
  conversation: Conversation,
  hidden?: boolean,
) {
  if (!page?.content.some((item) => item.id === conversation.id)) return page
  if (hidden !== undefined && conversation.hidden !== hidden)
    return {
      ...page,
      content: page.content.filter((item) => item.id !== conversation.id),
      totalElements: Math.max(0, page.totalElements - 1),
    }
  return {
    ...page,
    content: page.content
      .map((item) => (item.id === conversation.id ? conversation : item))
      .sort((a, b) => activity(b) - activity(a)),
  }
}
