import { Suspense } from "react"
import AuditLogsClient from "./audit-logs-client"

export const metadata = {
  title: "감사 로그 | Exit System",
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuditLogsClient />
    </Suspense>
  )
}
