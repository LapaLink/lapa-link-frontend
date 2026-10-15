import { CaseDetails } from "@/components/pages"

type CaseDetailsPageProps = {
  params: Promise<{ caseId: string }>
  searchParams: Promise<{ need?: string | string[] }>
}

export default async function CaseDetailsPage({
  params,
  searchParams,
}: CaseDetailsPageProps) {
  const { caseId } = await params
  const { need } = await searchParams
  return (
    <CaseDetails
      caseId={caseId}
      highlightNeedId={typeof need === "string" ? need : undefined}
    />
  )
}
