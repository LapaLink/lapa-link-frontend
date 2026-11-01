import type { Metadata } from "next"
import { ModerationReports } from "@/components/pages"

export const metadata: Metadata = { title: "Модерация жалоб" }

export default function ModerationReportsPage() {
  return <ModerationReports />
}
