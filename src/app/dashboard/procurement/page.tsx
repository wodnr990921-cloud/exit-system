import { Suspense } from "react"
import ProcurementClient from "./procurement-client"

export const dynamic = "force-dynamic"

export default function ProcurementPage() {
  return (
    <Suspense fallback={<div className="p-8">로딩 중...</div>}>
      <ProcurementClient />
    </Suspense>
  )
}
