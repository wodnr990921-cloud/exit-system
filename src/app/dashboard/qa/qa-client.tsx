"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Trash2, CornerUpLeft, Home } from "lucide-react"
import dynamic from "next/dynamic"

// 동적 임포트 (기존 컴포넌트 재사용)
const IntakeContent = dynamic(() => import("../intake/intake-client"), {
  loading: () => <div className="p-6">내 작업 목록 로딩 중...</div>,
  ssr: false,
})

const DocumentRetentionContent = dynamic(() => import("../document-retention/document-retention-client"), {
  loading: () => <div className="p-6">원본 파기 로딩 중...</div>,
  ssr: false,
})

const ReturnsContent = dynamic(() => import("../returns/returns-client"), {
  loading: () => <div className="p-6">반송 처리 로딩 중...</div>,
  ssr: false,
})

export default function QAClient() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState("intake")

  // 알림 메시지용 state
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 답변 일괄 출력
  const handleBatchPrintReplies = async () => {
    try {
      const { data: replies, error } = await supabase
        .from("task_items")
        .select(`
          id,
          description,
          created_at,
          task:tasks!inner(
            ticket_no,
            customer:customers(name, member_number, address)
          )
        `)
        .eq("category", "답변")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      if (!replies || replies.length === 0) {
        setError("출력할 답변이 없습니다.")
        setTimeout(() => setError(null), 3000)
        return
      }

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        setError("팝업 차단을 해제해주세요.")
        setTimeout(() => setError(null), 3000)
        return
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>답변 일괄 출력</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              .page-break { page-break-after: always; }
            }
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 30px; }
            .reply-item { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .recipient-address { font-size: 20px; font-weight: bold; margin-bottom: 20px; padding: 15px; background: white; border: 2px solid #333; border-radius: 4px; text-align: left; line-height: 1.6; }
            .reply-header { font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #333; }
            .reply-content { line-height: 1.8; white-space: pre-wrap; }
            .reply-footer { margin-top: 10px; text-align: right; color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>📮 문의답변 일괄 출력</h1>
          ${replies
            .map(
              (reply: any, index: number) => `
            <div class="reply-item ${index < replies.length - 1 ? "page-break" : ""}">
              <div class="recipient-address">
                ${reply.task?.customer?.address || "주소 없음"} ${reply.task?.customer?.name || "미등록"}
              </div>
              <div class="reply-header">
                티켓: ${reply.task?.ticket_no || "미지정"} |
                회원: ${reply.task?.customer?.name || "미지정"} (${reply.task?.customer?.member_number || ""})
              </div>
              <div class="reply-content">${reply.description}</div>
              <div class="reply-footer">
                작성일시: ${new Date(reply.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
          `
            )
            .join("")}
        </body>
        </html>
      `

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 500)

      setSuccess(`${replies.length}개의 답변을 출력 중입니다.`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error("Batch print error:", error)
      setError(error.message || "답변 출력 중 오류가 발생했습니다.")
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            문의/답변
          </h1>
          <p className="text-muted-foreground mt-2">
            작업 목록, 원본 파기, 반송 처리를 한 곳에서 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push("/dashboard/reception")}
            className="bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            + 신규 티켓 작성
          </Button>
          <Button
            variant="outline"
            onClick={handleBatchPrintReplies}
            className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
          >
            답변 일괄 출력
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Button>
        </div>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="intake" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">내 작업 목록</span>
            <span className="sm:hidden">작업</span>
          </TabsTrigger>
          <TabsTrigger value="document" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">원본 파기</span>
            <span className="sm:hidden">파기</span>
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <CornerUpLeft className="h-4 w-4" />
            <span className="hidden sm:inline">반송 처리</span>
            <span className="sm:hidden">반송</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="space-y-6">
          <Card>
            <IntakeContent />
          </Card>
        </TabsContent>

        <TabsContent value="document" className="space-y-6">
          <Card>
            <DocumentRetentionContent />
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <ReturnsContent />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
