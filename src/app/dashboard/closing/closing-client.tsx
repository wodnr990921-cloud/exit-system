"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserPlus, X, CheckCircle2, FileDown } from "lucide-react"
import { generateAndDownloadDailyPDF } from "@/lib/pdf-generator"

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

interface Customer {
  id: string
  name: string
  member_number: string
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

  // 신규 티켓 생성 관련 state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [taskCategory, setTaskCategory] = useState<string>("문의")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskAmount, setTaskAmount] = useState("")
  const [creating, setCreating] = useState(false)

  // 신규 회원 등록 관련 state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerMemberNumber, setNewCustomerMemberNumber] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")

  // 답변 작성 관련 state
  const [taskReplyText, setTaskReplyText] = useState("")

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
      
      // 데이터 변환: customer가 배열인 경우 첫 번째 요소 사용
      const transformedData = (data || []).map((task: any) => ({
        ...task,
        customer: Array.isArray(task.customer) ? task.customer[0] : task.customer,
      }))
      
      setTasks(transformedData)
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

  // 답변 저장
  const handleSaveReply = async () => {
    if (!selectedTask || !taskReplyText.trim()) {
      setError("답변 내용을 입력해주세요.")
      return
    }

    try {
      // Insert reply as task_item
      const { error: taskItemError } = await supabase.from("task_items").insert({
        task_id: selectedTask.id,
        category: "inquiry",
        description: taskReplyText.trim(),
        amount: 0,
        status: "approved",
      })

      if (taskItemError) throw taskItemError

      // Update task status to in_progress
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ 
          status: "in_progress",
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedTask.id)

      if (updateError) {
        console.warn("Failed to update task status:", updateError)
      }

      setSuccess("✅ 답변이 저장되고 티켓 상태가 업데이트되었습니다.")
      setTaskReplyText("")
      loadTasks()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      console.error("Save reply error:", error)
      setError(error.message || "답변 저장 중 오류가 발생했습니다.")
    }
  }

  // PDF 다운로드
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true)
    setError(null)

    try {
      const result = await generateAndDownloadDailyPDF()

      if (result) {
        setSuccess(`PDF 다운로드 완료: ${result.filename}`)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (error: any) {
      console.error('PDF 다운로드 오류:', error)
      setError(error.message || 'PDF 다운로드에 실패했습니다.')
    } finally {
      setDownloadingPDF(false)
    }
  }

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
        .eq("category", "inquiry")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      if (!replies || replies.length === 0) {
        setError("출력할 답변이 없습니다.")
        return
      }

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        setError("팝업 차단을 해제해주세요.")
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
          <h1>📮 마감업무 답변 일괄 출력</h1>
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
    }
  }

  // 회원 검색
  const handleSearchCustomer = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, member_number")
        .or(`name.ilike.%${query}%,member_number.ilike.%${query}%`)
        .limit(10)

      if (error) throw error

      setSearchResults(data || [])
    } catch (error: any) {
      console.error("Error searching customers:", error)
      setSearchResults([])
    }
  }

  // 신규 회원 등록
  const handleRegisterNewCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerMemberNumber.trim()) {
      setError("이름과 회원번호는 필수입니다.")
      return
    }

    try {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: newCustomerName.trim(),
          member_number: newCustomerMemberNumber.trim(),
          phone: newCustomerPhone.trim() || null,
          address: newCustomerAddress.trim() || null,
        })
        .select()
        .single()

      if (customerError) throw customerError

      setSelectedCustomer({
        id: newCustomer.id,
        name: newCustomer.name,
        member_number: newCustomer.member_number,
      })

      setShowNewCustomerForm(false)
      setNewCustomerName("")
      setNewCustomerMemberNumber("")
      setNewCustomerPhone("")
      setNewCustomerAddress("")
      setSearchQuery("")

      setSuccess(`${newCustomer.name} (${newCustomer.member_number}) 회원이 등록되었습니다.`)
    } catch (error: any) {
      console.error("Register customer error:", error)
      setError(error.message || "회원 등록 중 오류가 발생했습니다.")
    }
  }

  // 신규 티켓 생성
  const handleCreateTicket = async () => {
    if (!selectedCustomer) {
      setError("회원을 선택해주세요.")
      return
    }

    if (!taskDescription.trim()) {
      setError("요청 내용을 입력해주세요.")
      return
    }

    const amount = parseFloat(taskAmount) || 0

    setCreating(true)
    setError(null)

    try {
      // 1. Task 생성
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          customer_id: selectedCustomer.id,
          member_id: selectedCustomer.id,
          status: "pending",
          total_amount: amount,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // 2. Task Item 생성
      const { error: itemError } = await supabase
        .from("task_items")
        .insert({
          task_id: taskData.id,
          category: taskCategory,
          description: taskDescription.trim(),
          amount: amount,
          status: "pending",
        })

      if (itemError) throw itemError

      // 3. Task 금액 업데이트
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ total_amount: amount })
        .eq("id", taskData.id)

      if (updateError) throw updateError

      setSuccess(`티켓이 생성되었습니다. (티켓번호: ${taskData.ticket_no || taskData.id.substring(0, 8).toUpperCase()})`)
      
      // 초기화
      setShowCreateDialog(false)
      setSelectedCustomer(null)
      setSearchQuery("")
      setSearchResults([])
      setTaskCategory("문의")
      setTaskDescription("")
      setTaskAmount("")

      // 티켓 목록 새로고침
      loadTasks()

      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    } catch (error: any) {
      console.error("Error creating ticket:", error)
      setError(error.message || "티켓 생성에 실패했습니다.")
    } finally {
      setCreating(false)
    }
  }

  // Dialog 닫을 때 초기화
  const handleCloseDialog = () => {
    setShowCreateDialog(false)
    setSelectedCustomer(null)
    setSearchQuery("")
    setSearchResults([])
    setTaskCategory("문의")
    setTaskDescription("")
    setTaskAmount("")
    setError(null)
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
              onClick={() => setShowCreateDialog(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              + 신규 티켓 생성
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium"
            >
              <FileDown className="w-4 h-4 mr-2" />
              {downloadingPDF ? "PDF 생성 중..." : "PDF 다운로드"}
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
              onClick={loadTasks}
              className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
            >
              새로고침
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
                    <Card
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`cursor-pointer hover:shadow-lg transition-all border-2 bg-white dark:bg-gray-900 ${
                        selectedTask?.id === task.id
                          ? "border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700"
                          : "border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600"
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          {/* 첫 줄: 티켓 번호, 상태, 금액, 날짜 */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* 티켓 번호 */}
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              🎫 {task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                            </span>

                            {/* 상태 */}
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              ✅ 처리완료
                            </span>

                            {/* 회원 정보 */}
                            {task.customer && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                                <span className="text-xs text-gray-500 dark:text-gray-500 font-semibold">회원:</span>
                                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                                  {task.customer.name || "회원 정보 없음"} ({task.customer.member_number || "-"})
                                </span>
                              </div>
                            )}

                            {/* 날짜 */}
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 ml-auto">
                              <span className="text-xs text-gray-500 dark:text-gray-500 font-semibold">처리일:</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {formatDate(task.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* 두 번째 줄: AI 요약 */}
                          {task.ai_summary && (
                            <div>
                              <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed">
                                {task.ai_summary}
                              </p>
                            </div>
                          )}

                          {/* 세 번째 줄: 금액 및 처리 내역 */}
                          <div className="flex items-center gap-3 text-sm flex-wrap">
                            {/* 총액 */}
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">총액:</span>
                              <span className="text-sm text-green-700 dark:text-green-400 font-bold">
                                {formatAmount(task.total_amount)}원
                              </span>
                            </div>
                            
                            {/* 처리 항목 */}
                            {task.task_items && task.task_items.length > 0 && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-md border border-purple-200 dark:border-purple-800">
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">처리 항목:</span>
                                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">{task.task_items.length}개</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📋 처리 내역</Label>
                    </div>
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
                      <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">💬 답장 내용</Label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateReply}
                        disabled={generatingReply}
                        className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
                      >
                        {generatingReply ? "생성 중..." : "답장 재생성"}
                      </Button>
                    </div>
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="답장 내용이 여기에 표시됩니다. 필요시 수정할 수 있습니다."
                      className="min-h-[200px] border-gray-300 dark:border-gray-700 resize-none"
                    />
                  </div>

                  {/* 답변 작성 */}
                  <div className="space-y-2">
                    <div className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">✍️ 답변 작성</Label>
                    </div>
                    <Textarea
                      value={taskReplyText}
                      onChange={(e) => setTaskReplyText(e.target.value)}
                      placeholder="추가 답변을 작성하세요. (티켓에 답변으로 저장됩니다)"
                      className="min-h-[120px] border-gray-300 dark:border-gray-700 resize-none"
                    />
                    <Button
                      onClick={handleSaveReply}
                      disabled={!taskReplyText.trim()}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white font-medium"
                    >
                      답변 저장
                    </Button>
                  </div>

                  {/* 마감 승인 버튼 */}
                  <Button
                    onClick={handleApprove}
                    disabled={!replyContent.trim() || saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
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

        {/* 신규 티켓 생성 Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>신규 티켓 생성</DialogTitle>
              <DialogDescription>
                문의답변 티켓을 새로 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 회원 검색 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                    <Label htmlFor="customer-search" className="font-bold text-gray-900 dark:text-gray-100">👤 회원 검색</Label>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                    className="h-7 text-xs text-gray-900 dark:text-gray-100 hover:text-blue-700 hover:bg-blue-50 font-medium"
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    신규 회원 등록
                  </Button>
                </div>
                <Input
                  id="customer-search"
                  placeholder="회원명 또는 회원번호 입력"
                  value={searchQuery}
                  onChange={(e) => handleSearchCustomer(e.target.value)}
                  className="border-gray-300 dark:border-gray-700"
                />
                
                {/* 검색 결과 */}
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-[200px] overflow-y-auto">
                    {searchResults.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setSearchQuery(customer.name)
                          setSearchResults([])
                        }}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {customer.member_number}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 선택된 회원 */}
                {selectedCustomer && searchResults.length === 0 && (
                  <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedCustomer.name}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          {selectedCustomer.member_number}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(null)
                          setSearchQuery("")
                        }}
                        className="text-blue-600 dark:text-blue-400"
                      >
                        변경
                      </Button>
                    </div>
                  </div>
                )}

                {/* 신규 회원 등록 폼 */}
                {showNewCustomerForm && (
                  <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-green-900 dark:text-green-100">
                          ✨ 신규 회원 등록
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNewCustomerForm(false)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div>
                        <Label className="text-sm">이름 *</Label>
                        <Input
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="홍길동"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">회원번호 *</Label>
                        <Input
                          value={newCustomerMemberNumber}
                          onChange={(e) => setNewCustomerMemberNumber(e.target.value)}
                          placeholder="M001"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">전화번호</Label>
                        <Input
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          placeholder="010-1234-5678"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm">주소</Label>
                        <Input
                          value={newCustomerAddress}
                          onChange={(e) => setNewCustomerAddress(e.target.value)}
                          placeholder="서울시..."
                          className="mt-1"
                        />
                      </div>
                      
                      <Button
                        onClick={handleRegisterNewCustomer}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        회원 등록 및 선택
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* 카테고리 선택 */}
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <Label htmlFor="category" className="font-bold text-gray-900 dark:text-gray-100">📂 카테고리</Label>
                </div>
                <Select value={taskCategory} onValueChange={setTaskCategory}>
                  <SelectTrigger className="border-gray-300 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="문의">문의</SelectItem>
                    <SelectItem value="입금">입금</SelectItem>
                    <SelectItem value="출금">출금</SelectItem>
                    <SelectItem value="환불">환불</SelectItem>
                    <SelectItem value="상품">상품</SelectItem>
                    <SelectItem value="배팅">배팅</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 요청 내용 */}
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <Label htmlFor="description" className="font-bold text-gray-900 dark:text-gray-100">📝 요청 내용</Label>
                </div>
                <Textarea
                  id="description"
                  placeholder="티켓 내용을 입력하세요"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="min-h-[120px] border-gray-300 dark:border-gray-700"
                />
              </div>

              {/* 금액 */}
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                  <Label htmlFor="amount" className="font-bold text-gray-900 dark:text-gray-100">💰 금액 (선택)</Label>
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={taskAmount}
                  onChange={(e) => setTaskAmount(e.target.value)}
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={creating}
                className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateTicket}
                disabled={!selectedCustomer || !taskDescription.trim() || creating}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {creating ? "생성 중..." : "티켓 생성"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}