import { Suspense } from "react"
import SettlementsClient from "./settlements-client"

export const metadata = {
  title: "월말 정산 | Exit System",
}

export default function SettlementsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettlementsClient />
    </Suspense>
  )
}
