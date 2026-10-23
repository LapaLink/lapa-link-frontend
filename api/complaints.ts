import type { Complaint, CreateComplaintDto } from "@/types"
import { authorizedRequest } from "./instance"

export const complaintsApi = {
  /** Reports a case or a user to moderators; the target is not notified. */
  create: (data: CreateComplaintDto) =>
    authorizedRequest<Complaint>("/complaints", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
