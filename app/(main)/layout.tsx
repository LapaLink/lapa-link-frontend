import { AppLayout } from "@/components/layouts"
import { ChatProvider } from "@/components/providers"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ChatProvider>
      <AppLayout>{children}</AppLayout>
    </ChatProvider>
  )
}
