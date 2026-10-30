import type { FaqItem } from "@/types"
import { request } from "./instance"

export const faqApi = {
  /**
   * Published questions in display order, public. The language follows
   * Accept-Language: `be` is Belarusian, anything else Russian.
   */
  list: (signal?: AbortSignal) => request<FaqItem[]>("/faq", { signal }),
}
