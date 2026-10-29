import type { Complaint, CreateComplaintDto, PageResponse } from "@/types"
import { authorizedRequest } from "./instance"

export const complaintsApi = {
  /**
   * Reports a case, a user or a conversation to moderators; the target is not
   * notified. A conversation the user does not take part in is 404
   * CONVERSATION_NOT_FOUND.
   */
  create: (data: CreateComplaintDto) =>
    authorizedRequest<Complaint>("/complaints", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** The current user's complaints, newest first. */
  my: (page = 0, size = 20, signal?: AbortSignal) =>
    authorizedRequest<PageResponse<Complaint>>(
      `/complaints/my?page=${page}&size=${size}`,
      { signal },
    ),
}
