import { CaseDetails } from "@/components/pages"

type CaseDetailsPageProps = {
  params: Promise<{ caseId: string }>
}

export default async function CaseDetailsPage({ params }: CaseDetailsPageProps) {
  const { caseId } = await params
  return <CaseDetails caseId={caseId} />
}
