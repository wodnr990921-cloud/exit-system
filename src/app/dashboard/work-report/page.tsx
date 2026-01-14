import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import WorkReportClient from "./work-report-client"

export const metadata = {
  title: "업무보고 - 통합 관리 시스템",
  description: "출퇴근, 소모품 사용, 경비 지출, 전달사항 보고",
}

export default function WorkReportPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <WorkReportClient />
    </Suspense>
  )
}
