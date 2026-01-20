"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  work_type: string | null
  point_category: string | null
  amount: number | null
  created_at: string
  summary?: string
  comment_count?: number
  category?: string
  has_return?: boolean
  return_info?: {
    return_reason: string
    return_date: string
    refund_status: string
  }
  items?: Array<{
    id: string
    match_id?: string | null
    betting_choice?: string | null
    betting_odds?: number | null
    potential_win?: number | null
    category?: string
    description?: string
    amount?: number
  }>
  customer: {
    member_number: string
    name: string
    institution: string | null
    prison_number: string | null
  } | null
  user: {
    name: string | null
    username: string
  } | null
  assigned_to_user: {
    name: string | null
    username: string
  } | null
}

interface TaskComment {
  id: string
  comment: string
  comment_type: 'internal' | 'reply' // internal: 내부 소통용, reply: 회원 발송용
  sent_to_member: boolean
  sent_at: string | null
  created_at: string
  user: {
    name: string | null
    username: string
  } | null
}


export default function IntakeClient() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<"keyword" | "member" | "assignee">("keyword")

  // 반송 처리
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [returnReason, setReturnReason] = useState<string>("")
  const [returnNotes, setReturnNotes] = useState("")
  const [processingReturn, setProcessingReturn] = useState(false)

  // 댓글/답글 작성
  const [newComment, setNewComment] = useState("")
  const [commentType, setCommentType] = useState<'internal' | 'reply'>('internal')
  const [addingComment, setAddingComment] = useState(false)

  // 답변 작성 관련 state
  const [taskReplyText, setTaskReplyText] = useState("")
  
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadAllTasks()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch()
    } else {
      setTasks(allTasks)
    }
  }, [searchQuery, searchType, allTasks])

  const loadAllTasks = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          customer:customers!tasks_customer_id_fkey (member_number, name, institution, prison_number),
          user:users!tasks_user_id_fkey (name, username),
          assigned_to_user:users!tasks_assigned_to_fkey (name, username),
          items:task_items(id, match_id, betting_choice, betting_odds, potential_win, category, description, amount)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      // 각 티켓에 댓글 수, 반송 정보 추가 및 요약 생성
      const tasksWithSummary = await Promise.all(
        (data || []).map(async (task) => {
          // 댓글 수 조회
          const { count } = await supabase
            .from("task_comments")
            .select("*", { count: "exact", head: true })
            .eq("task_id", task.id)

          // 반송 정보 조회
          const { data: returnData } = await supabase
            .from("returns")
            .select("return_reason, return_date, refund_status")
            .eq("task_id", task.id)
            .single()

          // 요약 생성
          let summary = ""
          if (task.description) {
            try {
              const summaryResponse = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: task.description }),
              })
              const summaryData = await summaryResponse.json()
              if (summaryData.success) {
                summary = summaryData.summary
              }
            } catch (error) {
              console.error("Error generating summary:", error)
              summary = task.description.substring(0, 100) + "..."
            }
          }

          // 카테고리 분류
          let category = "기타"
          if (task.description) {
            try {
              const categoryResponse = await fetch("/api/categorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: task.description }),
              })
              const categoryData = await categoryResponse.json()
              if (categoryData.success) {
                category = categoryData.category
              }
            } catch (error) {
              console.error("Error categorizing task:", error)
            }
          }

          return {
            ...task,
            comment_count: count || 0,
            summary: summary || task.description?.substring(0, 100) || "",
            category: category,
            has_return: !!returnData,
            return_info: returnData || undefined,
          }
        })
      )

      setAllTasks(tasksWithSummary)
      setTasks(tasksWithSummary)
    } catch (error: any) {
      console.error("Error loading tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setTasks(allTasks)
      return
    }

    const query = searchQuery.toLowerCase().trim()

    const filtered = allTasks.filter((task) => {
      if (searchType === "keyword") {
        return (
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.customer?.name?.toLowerCase().includes(query) ||
          task.customer?.member_number?.toLowerCase().includes(query) ||
          task.user?.name?.toLowerCase().includes(query) ||
          task.user?.username?.toLowerCase().includes(query) ||
          task.assigned_to_user?.name?.toLowerCase().includes(query) ||
          task.assigned_to_user?.username?.toLowerCase().includes(query)
        )
      } else if (searchType === "member") {
        return (
          task.customer?.name?.toLowerCase().includes(query) ||
          task.customer?.member_number?.toLowerCase().includes(query)
        )
      } else if (searchType === "assignee") {
        return (
          task.assigned_to_user?.name?.toLowerCase().includes(query) ||
          task.assigned_to_user?.username?.toLowerCase().includes(query)
        )
      }
      return false
    })

    setTasks(filtered)
  }

  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task)
    setIsTaskDialogOpen(true)
    await loadTaskComments(task.id)
  }

  const loadTaskComments = async (taskId: string) => {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from("task_comments")
        .select(
          `
          *,
          user:users!task_comments_user_id_fkey (name, username)
        `
        )
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })

      if (error) throw error
      setTaskComments(data || [])
    } catch (error: any) {
      console.error("Error loading comments:", error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return

    setAddingComment(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("로그인이 필요합니다.")

      const { error } = await supabase.from("task_comments").insert({
        task_id: selectedTask.id,
        user_id: user.id,
        comment: newComment.trim(),
        comment_type: commentType,
        sent_to_member: false,
      })

      if (error) throw error

      // 댓글 목록 새로고침
      await loadTaskComments(selectedTask.id)
      setNewComment("")
      setCommentType('internal')

      // 답글인 경우 회원에게 발송 처리 (실제로는 API 호출 필요)
      if (commentType === 'reply') {
        // TODO: 회원에게 답글 발송 API 호출
        console.log("회원에게 답글 발송:", newComment)
      }
    } catch (error: any) {
      console.error("Error adding comment:", error)
      alert(error.message || "댓글 추가에 실패했습니다.")
    } finally {
      setAddingComment(false)
    }
  }

  const handleReturnClick = (task: Task) => {
    setSelectedTask(task)
    setIsReturnDialogOpen(true)
    setReturnReason("")
    setReturnNotes("")
  }

  const handleProcessReturn = async () => {
    if (!selectedTask || !returnReason) {
      alert("반송 사유를 선택해주세요.")
      return
    }

    setProcessingReturn(true)
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.id,
          returnReason,
          returnNotes,
          returnDate: new Date().toISOString().split("T")[0],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "반송 처리에 실패했습니다.")
      }

      alert("반송 처리가 완료되었습니다.")
      setIsReturnDialogOpen(false)
      loadAllTasks() // 목록 새로고침
    } catch (error: any) {
      console.error("Error processing return:", error)
      alert(error.message || "반송 처리 중 오류가 발생했습니다.")
    } finally {
      setProcessingReturn(false)
    }
  }


  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(date)
    taskDate.setHours(0, 0, 0, 0)

    if (taskDate.getTime() === today.getTime()) {
      return "오늘 " + date.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatTaskId = (id: string) => {
    return id.substring(0, 8).toUpperCase()
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "대기",
      assigned: "접수",
      in_progress: "처리중",
      completed: "완료",
      pending_review: "검토중",
      closed: "마감",
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      assigned: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      pending_review: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      closed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    }
    return colors[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 및 네비게이션 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">티켓 목록</h1>
          <Button onClick={() => router.push("/dashboard/reception")} className="bg-blue-600 hover:bg-blue-700">
            + 신규 티켓 작성
          </Button>
        </div>

        {/* 검색 */}
        <Card className="mb-6 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">티켓 검색</CardTitle>
            <CardDescription>키워드, 회원, 담당자별로 티켓을 검색할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Select value={searchType} onValueChange={(value: "keyword" | "member" | "assignee") => setSearchType(value)}>
                <SelectTrigger className="w-32 border-gray-300 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">키워드</SelectItem>
                  <SelectItem value="member">회원</SelectItem>
                  <SelectItem value="assignee">담당자</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={searchType === "keyword" ? "키워드 입력" : searchType === "member" ? "회원명 또는 회원번호" : "담당자명"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
              />
              <Button onClick={handleSearch} disabled={!searchQuery.trim()} className="bg-blue-600 hover:bg-blue-700">
                조회
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 티켓 목록 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">티켓 목록</CardTitle>
            <CardDescription>총 {tasks.length}개의 티켓</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">티켓이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-lg transition-all border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-900"
                    onClick={() => handleTaskClick(task)}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {/* 첫 줄: (상태) (반송) (기관수번이름) (날짜) */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* 상태 */}
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>

                          {/* 반송 배지 */}
                          {task.has_return && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                              ⚠️ 반송
                            </span>
                          )}

                          {/* 수용기관+수번+이름 */}
                          {task.customer && (
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                              {task.customer.institution && task.customer.prison_number
                                ? `${task.customer.institution} ${task.customer.prison_number} ${task.customer.name}`
                                : task.customer.name || "-"}
                            </span>
                          )}

                          {/* 날짜 */}
                          <span className="text-sm text-gray-500 dark:text-gray-500">
                            {formatDate(task.created_at)}
                          </span>
                        </div>

                        {/* 두 번째 줄: 카테고리    요약내용 */}
                        <div className="flex items-start gap-4">
                          {/* 카테고리 */}
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              {task.category || "기타"}
                            </span>
                          </div>

                          {/* 요약 내용 */}
                          <div className="flex-1">
                            <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed">
                              {task.summary || task.description?.substring(0, 150) || "내용 없음"}
                            </p>
                          </div>
                        </div>

                        {/* 세 번째 줄: 담당직원 변동포인트 */}
                        <div className="flex items-center gap-4 text-sm">
                          {/* 담당직원 */}
                          <div className="text-gray-600 dark:text-gray-400">
                            <span className="text-gray-500 dark:text-gray-500">담당:</span>{" "}
                            <span className="font-medium">
                              {task.assigned_to_user?.name || task.assigned_to_user?.username || "-"}
                            </span>
                          </div>

                          {/* 배팅 정보 (있는 경우) */}
                          {task.items && task.items.some((item: any) => item.match_id) && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                              <span className="text-yellow-700 dark:text-yellow-300 text-xs font-semibold">
                                ⚽ 스포츠 배팅
                              </span>
                              <span className="text-yellow-600 dark:text-yellow-400 text-xs">
                                {task.items.filter((item: any) => item.match_id).length}경기
                              </span>
                            </div>
                          )}

                          {/* 변동포인트 */}
                          {task.amount && (
                            <div className={`font-medium ${
                              task.amount > 0
                                ? "text-green-600 dark:text-green-400"
                                : task.amount < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-600 dark:text-gray-400"
                            }`}>
                              {task.amount > 0 ? "+" : ""}{formatNumber(task.amount)}원
                              {task.point_category && ` (${task.point_category})`}
                            </div>
                          )}

                          {/* 반송 버튼 */}
                          {!task.has_return && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleReturnClick(task)
                              }}
                            >
                              반송 처리
                            </Button>
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

        {/* 티켓 상세 다이얼로그 */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">티켓 상세 정보</DialogTitle>
              <DialogDescription>티켓의 상세 정보와 댓글을 확인할 수 있습니다.</DialogDescription>
            </DialogHeader>

            {selectedTask && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">🎫 티켓번호</Label>
                    </div>
                    <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-50">{formatTaskId(selectedTask.id)}</p>
                  </div>
                  <div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📌 상태</Label>
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                        {getStatusLabel(selectedTask.status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">👤 회원</Label>
                    </div>
                    <p className="mt-1 text-base text-gray-900 dark:text-gray-50">
                      {selectedTask.customer ? `${selectedTask.customer.member_number} - ${selectedTask.customer.name}` : "-"}
                    </p>
                  </div>
                  <div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">👨‍💼 담당자</Label>
                    </div>
                    <p className="mt-1 text-base text-gray-900 dark:text-gray-50">
                      {selectedTask.assigned_to_user?.name || selectedTask.assigned_to_user?.username || "-"}
                    </p>
                  </div>
                  <div>
                    <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📅 등록일시</Label>
                    </div>
                    <p className="mt-1 text-base text-gray-900 dark:text-gray-50">{formatDate(selectedTask.created_at)}</p>
                  </div>
                </div>

                <div>
                  <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md mb-1">
                    <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📋 제목</Label>
                  </div>
                  <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-50">{selectedTask.title}</p>
                </div>

                <div>
                  <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md mb-1">
                    <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📝 내용</Label>
                  </div>
                  <p className="mt-1 text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedTask.description || "-"}
                  </p>
                </div>

                {/* 배팅 정보 (있는 경우) */}
                {selectedTask.items && selectedTask.items.some(item => item.match_id) && (
                  <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950">
                    <Label className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-3 block flex items-center gap-2">
                      <span>⚽</span>
                      스포츠 배팅 정보
                    </Label>
                    <div className="space-y-2">
                      {selectedTask.items.filter(item => item.match_id).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded border border-yellow-100 dark:border-yellow-900">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              경기 #{idx + 1}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              선택: {item.betting_choice === 'home' ? '홈팀 승' : item.betting_choice === 'away' ? '원정팀 승' : '무승부'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">배당</div>
                            <div className="font-bold text-yellow-700 dark:text-yellow-400">
                              {item.betting_odds?.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">배팅액</div>
                            <div className="font-semibold">{item.amount?.toLocaleString()}P</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 dark:text-gray-400">예상당첨</div>
                            <div className="font-bold text-green-600 dark:text-green-400">
                              {item.potential_win?.toLocaleString()}P
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-4">
                  <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                    <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">💬 댓글 / 답글</Label>
                  </div>
                  
                  {/* 댓글 목록 */}
                  {loadingComments ? (
                    <div className="text-center p-4 text-gray-500 dark:text-gray-400">로딩 중...</div>
                  ) : taskComments.length === 0 ? (
                    <div className="text-center p-4 text-gray-500 dark:text-gray-400">댓글이 없습니다.</div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {taskComments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className={`p-3 rounded-md ${
                            comment.comment_type === 'reply' 
                              ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800' 
                              : 'bg-gray-50 dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                                {comment.user?.name || comment.user?.username || "알 수 없음"}
                              </span>
                              {comment.comment_type === 'reply' && (
                                <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">
                                  답글 {comment.sent_to_member ? '✓ 발송됨' : ''}
                                </span>
                              )}
                              {comment.comment_type === 'internal' && (
                                <span className="text-xs px-2 py-0.5 bg-gray-400 text-white rounded">
                                  내부
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 새 댓글/답글 작성 */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={commentType === 'internal' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCommentType('internal')}
                        className={commentType === 'internal' ? 'bg-gray-600 text-white font-medium' : 'text-gray-900 dark:text-gray-100 font-medium'}
                      >
                        💬 댓글 (내부)
                      </Button>
                      <Button
                        type="button"
                        variant={commentType === 'reply' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCommentType('reply')}
                        className={commentType === 'reply' ? 'bg-blue-600 text-white font-medium' : 'text-gray-900 dark:text-gray-100 font-medium'}
                      >
                        📧 답글 (회원)
                      </Button>
                    </div>
                    <Textarea
                      placeholder={
                        commentType === 'internal' 
                          ? "내부 직원 간 소통용 댓글을 입력하세요..." 
                          : "회원에게 발송될 답글을 입력하세요..."
                      }
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className={commentType === 'reply' ? 'border-blue-300 dark:border-blue-700' : ''}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className={commentType === 'reply' ? 'bg-blue-600 hover:bg-blue-700 text-white font-medium' : 'bg-gray-600 hover:bg-gray-700 text-white font-medium'}
                      size="sm"
                    >
                      {addingComment ? "추가 중..." : commentType === 'reply' ? "답글 발송" : "댓글 추가"}
                    </Button>
                  </div>
                </div>

                {/* 답변 작성 (task_items에 저장) */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                    <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">✍️ 답변 작성</Label>
                  </div>
                  <Textarea
                    placeholder="추가 답변을 작성하세요. (티켓에 답변으로 저장됩니다)"
                    value={taskReplyText}
                    onChange={(e) => setTaskReplyText(e.target.value)}
                    rows={3}
                    className="border-gray-300 dark:border-gray-700"
                  />
                  <Button
                    onClick={async () => {
                      if (!selectedTask || !taskReplyText.trim()) return

                      try {
                        const { error } = await supabase.from("task_items").insert({
                          task_id: selectedTask.id,
                          category: "답변",
                          description: taskReplyText.trim(),
                          amount: 0,
                          status: "approved",
                        })

                        if (error) throw error

                        setTaskReplyText("")
                        toast({
                          title: "답변 저장 완료",
                          description: "답변이 티켓에 저장되었습니다.",
                        })
                      } catch (error: any) {
                        console.error("Save reply error:", error)
                        toast({
                          variant: "destructive",
                          title: "오류",
                          description: error.message || "답변 저장 중 오류가 발생했습니다.",
                        })
                      }
                    }}
                    disabled={!taskReplyText.trim()}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white font-medium"
                  >
                    답변 저장
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)} className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium">
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 반송 처리 다이얼로그 */}
        <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>반송 처리</DialogTitle>
              <DialogDescription>
                티켓을 반송 처리합니다. 반송 사유를 선택해주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="return-reason">반송 사유 *</Label>
                <Select value={returnReason} onValueChange={setReturnReason}>
                  <SelectTrigger id="return-reason">
                    <SelectValue placeholder="사유 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refused">수취 거부</SelectItem>
                    <SelectItem value="address_unknown">주소 불명</SelectItem>
                    <SelectItem value="moved">이감/출소</SelectItem>
                    <SelectItem value="restricted_item">금지 물품</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-notes">상세 내용</Label>
                <Textarea
                  id="return-notes"
                  placeholder="반송에 대한 상세 내용을 입력하세요..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsReturnDialogOpen(false)}
                disabled={processingReturn}
              >
                취소
              </Button>
              <Button
                onClick={handleProcessReturn}
                disabled={processingReturn || !returnReason}
                className="bg-red-600 hover:bg-red-700"
              >
                {processingReturn ? "처리 중..." : "반송 처리"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
