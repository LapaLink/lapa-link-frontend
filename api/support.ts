import type { PageResponse, SupportQuestion } from "@/types"
import { authorizedRequest } from "./instance"

export const supportApi = {
  /**
   * Asks the administration (1..2000 characters): opens a SUPPORT chat with
   * the question as its first message. 409 OPERATION_IN_PROGRESS on a double send.
   */
  ask: (message: string) =>
    authorizedRequest<SupportQuestion>("/support-questions", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  /** Own questions, newest first. */
  my: (page = 0, size = 20, signal?: AbortSignal) =>
    authorizedRequest<PageResponse<SupportQuestion>>(
      `/support-questions/my?page=${page}&size=${size}`,
      { signal },
    ),
}
