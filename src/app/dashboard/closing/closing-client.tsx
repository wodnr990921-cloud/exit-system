"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Task {
  id: string
  ticket_no: string | null
  member_id: string | null
  total_amount: number | null
  ai_summary: string | null
  reply_content: string | null
  status: string
  created_at: string
  customer: {
    id: string
    name: string
    member_number: string
  } | null
  task_items: Array<{
    id: string
    category: string
    description: string
    amount: number
    status: string
  }>
}

export default function ClosingClient() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [generatingReply, setGeneratingReply] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dailySummary, setDailySummary] = useState<{
    generalRevenue: number
    bettingRevenue: number
    bettingPayout: number
    netProfit: number
  } | null>(null)

  useEffect(() => {
    loadTasks()
    loadDailySummary()
  }, [])

  useEffect(() => {
    if (selectedTask) {
      loadReplyContent()
    }
  }, [selectedTask])

  const loadTasks = async () => {
    setLoading(true)
    try {
      // 오늘 날짜로 필터링
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          ticket_no,
          member_id,
          total_amount,
          ai_summary,
          reply_content,
          status,
          created_at,
          customer:customers!tasks_member_id_fkey (
            id,
            name,
            member_number
          ),
          task_items (
            id,
            category,
            description,
            amount,
            status
          )
        `
        )
        .in("status", ["completed", "processed"])
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error: any) {
      console.error("Error loading tasks:", error)
      setError("티켓 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const loadDailySummary = async () => {
    try {
      const response = await fetch("/api/finance/daily-summary")
      const data = await response.json()

      if (response.ok && data.success) {
        setDailySummary({
          generalRevenue: data.summary.generalRevenue || 0,
          bettingRevenue: data.summary.bettingRevenue || 0,
          bettingPayout: data.summary.bettingPayout || 0,
          netProfit: data.summary.netProfit || 0,
        })
      }
    } catch (error: any) {
      console.error("Error loading daily summary:", error)
    }
  }

  const loadReplyContent = async () => {
    if (!selectedTask) return

    // 이미 생성된 답장이 있으면 불러오기
    if (selectedTask.reply_content) {
      setReplyContent(selectedTask.reply_content)
    } else {
      // 답장이 없으면 생성
      generateReply()
    }
  }

  const generateReply = async () => {
    if (!selectedTask) return

    setGeneratingReply(true)
    setError(null)

    try {
      const response = await fetch("/api/closing/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask.id }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "답장 생성에 실패했습니다.")
      }

      setReplyContent(data.replyContent || "")
    } catch (error: any) {
      console.error("Error generating reply:", error)
      setError(error.message || "답장 생성에 실패했습니다.")
    } finally {
      setGeneratingReply(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedTask || !replyContent.trim()) {
      setError("답장 내용을 입력해주세요.")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/closing/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.id,
          replyContent: replyContent.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "마감 처리에 실패했습니다.")
      }

      setSuccess("마감 처리가 완료되었습니다.")
      setSelectedTask(null)
      setReplyContent("")
      loadTasks()
      loadDailySummary()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      console.error("Error approving closing:", error)
      setError(error.message || "마감 처리에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "0"
    return amount.toLocaleString("ko-KR")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">일일 마감</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadTasks}
              className="border-gray-300 dark:border-gray-700"
            >
              새로고침
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/closing/print")}
              className="border-gray-300 dark:border-gray-700"
            >
              일괄 출력
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

        {/* 좌우 분할 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 수지 현황 및 티켓 리스트 */}
          <div className="space-y-6">
            {/* 수지 현황 카드 */}
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle>오늘 수지 현황</CardTitle>
                <CardDescription>일일 매출 및 수익 요약</CardDescription>
              </CardHeader>
              <CardContent>
                {dailySummary ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">일반 매출</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-50">
                        {formatAmount(dailySummary.generalRevenue)}원
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">배팅 매출</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-50">
                        {formatAmount(dailySummary.bettingRevenue)}원
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">배팅 당첨 지급액</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        -{formatAmount(dailySummary.bettingPayout)}원
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">순수익</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatAmount(dailySummary.netProfit)}원
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">수지 현황을 불러오는 중...</div>
                )}
              </CardContent>
            </Card>

            {/* 티켓 리스트 카드 */}
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader>
                <CardTitle>마감 대기 티켓</CardTitle>
                <CardDescription>오늘 처리 완료된 티켓 목록 ({tasks.length}건)</CardDescription>
              </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  마감 대기 중인 티켓이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedTask?.id === task.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-50">
                            {task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {task.customer?.name || "회원 정보 없음"} ({task.customer?.member_number || "-"})
                          </div>
                          {task.ai_summary && (
                            <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                              {task.ai_summary}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-gray-50">
                            {formatAmount(task.total_amount)}원
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {formatDate(task.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            </Card>
          </div>

          {/* 우측: 답장 미리보기 및 수정 */}
          <Card className="lg:col-span-2 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle>답장 미리보기</CardTitle>
              <CardDescription>
                {selectedTask
                  ? `${selectedTask.ticket_no || selectedTask.id.substring(0, 8).toUpperCase()} - ${selectedTask.customer?.name || "회원 정보 없음"}`
                  : "좌측에서 티켓을 선택하세요"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTask ? (
                <>
                  {/* 처리 내역 요약 */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">처리 내역</Label>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm">
                      {selectedTask.task_items.length === 0 ? (
                        <div className="text-gray-500 dark:text-gray-400">처리 내역이 없습니다.</div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTask.task_items.map((item) => (
                            <div key={item.id} className="flex justify-between">
                              <span>{item.description}</span>
                              <span className="font-medium">{formatAmount(item.amount)}원</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex justify-between font-semibold">
                            <span>총액</span>
                            <span>{formatAmount(selectedTask.total_amount)}원</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 답장 내용 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">답장 내용</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateReply}
                        disabled={generatingReply}
                        className="border-gray-300 dark:border-gray-700"
                      >
                        {generatingReply ? "생성 중..." : "답장 재생성"}
                      </Button>
                    </div>
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="답장 내용이 여기에 표시됩니다. 필요시 수정할 수 있습니다."
                      className="min-h-[300px] border-gray-300 dark:border-gray-700 resize-none"
                    />
                  </div>

                  {/* 마감 승인 버튼 */}
                  <Button
                    onClick={handleApprove}
                    disabled={!replyContent.trim() || saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? "마감 처리 중..." : "마감 승인"}
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  좌측에서 티켓을 선택하면 답장 미리보기가 표시됩니다.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}