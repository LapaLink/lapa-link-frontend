import type { Metadata } from "next"
import { Onboarding } from "@/components/pages"

export const metadata: Metadata = { title: "Настройка профиля" }

export default function WelcomePage() {
  return <Onboarding />
}
