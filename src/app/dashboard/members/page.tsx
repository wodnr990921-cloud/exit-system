import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import MembersClient from "./members-client"

export const metadata = {
  title: "회원관리 - 통합 관리 시스템",
  description: "회원, 수용자, 블랙리스트 통합 관리",
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <MembersClient />
    </Suspense>
  )
}
