import { Suspense } from "react"
import { CaseCardsSkeleton } from "@/components/common"
import { CasesList } from "@/components/pages"

export default function CasesPage() {
  return (
    // The feed reads its filters from the URL (useSearchParams).
    <Suspense fallback={<CaseCardsSkeleton />}>
      <CasesList />
    </Suspense>
  )
}
