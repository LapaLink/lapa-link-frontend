import { EditCase } from "@/components/pages"

export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const { caseId } = await params
  return <EditCase caseId={caseId} />
}
