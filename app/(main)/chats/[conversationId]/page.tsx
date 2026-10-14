import { Chat } from "@/components/pages"

type ChatPageProps = {
  params: Promise<{ conversationId: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params
  return <Chat conversationId={conversationId} />
}
