import { Suspense } from "react"
import MemberDetailClient from "./member-detail-client"

export const dynamic = "force-dynamic"

export default function MemberDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-8">로딩 중...</div>}>
      <MemberDetailClient memberId={params.id} />
    </Suspense>
  )
}
