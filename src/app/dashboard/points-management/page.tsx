import { Suspense } from "react"
import PointsManagementClient from "./points-management-client"

export const metadata = {
  title: "포인트관리 | Exit System",
  description: "포인트 지급/사용내역 및 휴면 포인트 통합 관리",
}

export default function PointsManagementPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PointsManagementClient />
    </Suspense>
  )
}
