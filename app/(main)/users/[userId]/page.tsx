import { UserProfile } from "@/components/pages"

type UserPageProps = { params: Promise<{ userId: string }> }

export default async function UserPage({ params }: UserPageProps) {
  const { userId } = await params
  return <UserProfile userId={userId} />
}
