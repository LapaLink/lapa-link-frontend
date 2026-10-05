import type { Metadata } from "next"
import { CreateCase } from "@/components/pages"

export const metadata: Metadata = { title: "Создать объявление" }

export default function CreateCasePage() {
  return <CreateCase />
}
