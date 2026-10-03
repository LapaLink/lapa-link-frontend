import { AppLayout } from "@/components/layouts"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
