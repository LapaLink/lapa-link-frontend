import { Suspense } from "react"
import { CaseFeedSkeleton, CasesList } from "@/components/pages"

export default function CasesPage() {
  return (
    // The feed reads its filters from the URL (useSearchParams).
    <Suspense fallback={<CaseFeedSkeleton />}>
      <CasesList />
    </Suspense>
  )
}
