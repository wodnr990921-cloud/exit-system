import { Suspense } from "react"
import MemberDetailClient from "./member-detail-client"

export const dynamic = "force-dynamic"

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <Suspense fallback={<div className="p-8">로딩 중...</div>}>
      <MemberDetailClient memberId={id} />
    </Suspense>
  )
}
