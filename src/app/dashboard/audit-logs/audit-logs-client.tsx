"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import AuditLogViewer from "@/components/audit-log-viewer"
import { ArrowLeft, Home, Shield } from "lucide-react"

interface AuditLogsClientProps {
  userRole: string
  userId: string
}

export default function AuditLogsClient({ userRole, userId }: AuditLogsClientProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <Home className="w-4 h-4 mr-2" />
            홈
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">감사 로그</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                시스템 전체 활동 기록 조회 ({userRole === "ceo" ? "CEO" : "관리자"} 전용)
              </p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">감사 로그 안내</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                이 페이지는 시스템의 모든 중요한 활동을 추적합니다. 포인트 충전/차감, 업무 승인, 배팅 정산, 사용자 관리 등 모든 액션이 기록되어 투명성과 추적성을 보장합니다.
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                <li>• 모든 로그는 수정 또는 삭제가 불가능합니다 (불변 기록)</li>
                <li>• 각 액션에는 수행자, 시간, 변경 내용이 기록됩니다</li>
                <li>• 실패한 액션도 기록되어 문제 해결에 도움을 줍니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Audit Log Viewer */}
        <AuditLogViewer userRole={userRole} maxHeight="calc(100vh - 350px)" />
      </div>
    </div>
  )
}
