import { Camera } from "lucide-react"
import { SectionCard } from "@/components/common"
import type { CurrentUser } from "@/types"
import { AvatarEditor } from "./AvatarEditor"

export function AvatarCard({ user }: { user: CurrentUser }) {
  return (
    <SectionCard
      icon={Camera}
      title="Фото профиля"
      description="С фото вас будет проще узнать."
      fullWidthBody
    >
      <AvatarEditor user={user} />
    </SectionCard>
  )
}
