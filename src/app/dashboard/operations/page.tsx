import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import OperationsClient from "./operations-client"

export const metadata = {
  title: "업무관리 - 통합 관리 시스템",
  description: "재무관리, 일일마감, 월말정산, 휴면포인트, 소모품재고 통합 관리",
}

export default function OperationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <OperationsClient />
    </Suspense>
  )
}
