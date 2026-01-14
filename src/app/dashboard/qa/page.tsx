import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import QAClient from "./qa-client"

export const metadata = {
  title: "문의/답변 - 통합 관리 시스템",
  description: "내 작업 목록, 원본 파기, 반송 처리 통합 관리",
}

export default function QAPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <QAClient />
    </Suspense>
  )
}
