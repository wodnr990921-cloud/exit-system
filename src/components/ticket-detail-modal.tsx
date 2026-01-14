"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, ZoomIn, ZoomOut, X } from "lucide-react"
import {
  Dialog as ImageDialog,
  DialogContent as ImageDialogContent,
} from "@/components/ui/dialog"

interface TaskItem {
  id: string
  task_id: string
  category: string
  description: string
  amount: number
  status: string
  created_at: string
}

interface TaskComment {
  id: string
  task_id: string
  user_id: string
  comment: string
  comment_type: string
  created_at: string
  user: {
    name: string | null
    username: string
  } | null
}

interface Task {
  id: string
  ticket_no: string | null
  title: string
  description: string | null
  status: string
  image_url: string | null
  ai_summary: string | null
  member_id: string | null
  assigned_to: string | null
  approved_by: string | null
  created_at: string
  customer: {
    member_number: string
    name: string
  } | null
}

interface TicketDetailModalProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId?: string | null
  userRole?: string | null
  onUpdate?: () => void
}

export default function TicketDetailModal({
  task,
  open,
  onOpenChange,
  currentUserId,
  userRole,
  onUpdate,
}: TicketDetailModalProps) {
  const supabase = createClient()
  const [taskItems, setTaskItems] = useState<TaskItem[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [newCustomerReply, setNewCustomerReply] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [postingReply, setPostingReply] = useState(false)
  const [imageZoom, setImageZoom] = useState(false)
  const [imageScale, setImageScale] = useState(1)
  const [employees, setEmployees] = useState<any[]>([])
  const [showAdminMenu, setShowAdminMenu] = useState(false)

  const isAdmin = userRole && ["operator", "ceo", "admin"].includes(userRole)

  useEffect(() => {
    if (task && open) {
      loadTaskItems()
      loadComments()
      if (isAdmin) {
        loadEmployees()
      }
    }
  }, [task, open])

  const loadTaskItems = async () => {
    if (!task) return
    setLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from("task_items")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true })

      if (error) throw error
      setTaskItems(data || [])
    } catch (error: any) {
      console.error("Error loading task items:", error)
    } finally {
      setLoadingItems(false)
    }
  }

  const loadComments = async () => {
    if (!task) return
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
        .eq("task_id", task.id)
        .order("created_at", { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error: any) {
      console.error("Error loading comments:", error)
    } finally {
      setLoadingComments(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, username, role")
        .in("role", ["employee", "staff"])
        .order("name", { ascending: true })

      if (error) throw error
      setEmployees(data || [])
    } catch (error: any) {
      console.error("Error loading employees:", error)
    }
  }

  const handlePostComment = async () => {
    if (!task || !newComment.trim() || !currentUserId) return

    setPostingComment(true)
    try {
      const { error } = await supabase.from("task_comments").insert([
        {
          task_id: task.id,
          user_id: currentUserId,
          comment: newComment.trim(),
          comment_type: "internal",
        },
      ])

      if (error) throw error

      setNewComment("")
      await loadComments()
    } catch (error: any) {
      console.error("Error posting comment:", error)
    } finally {
      setPostingComment(false)
    }
  }

  const handlePostCustomerReply = async () => {
    if (!task || !newCustomerReply.trim() || !currentUserId) return

    setPostingReply(true)
    try {
      const { error } = await supabase.from("task_comments").insert([
        {
          task_id: task.id,
          user_id: currentUserId,
          comment: newCustomerReply.trim(),
          comment_type: "customer_reply",
        },
      ])

      if (error) throw error

      setNewCustomerReply("")
      await loadComments()
      if (onUpdate) onUpdate()
    } catch (error: any) {
      console.error("Error posting customer reply:", error)
    } finally {
      setPostingReply(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id)

      if (error) throw error

      if (onUpdate) onUpdate()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error changing status:", error)
    }
  }

  const handleAssigneeChange = async (employeeId: string) => {
    if (!task) return

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: employeeId })
        .eq("id", task.id)

      if (error) throw error

      if (onUpdate) onUpdate()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error changing assignee:", error)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      book: "도서",
      game: "경기",
      goods: "물품",
      inquiry: "문의",
      complaint: "민원",
      other: "기타",
      complex: "복합",
    }
    return labels[category] || category
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      refunded: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      won: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "대기",
      approved: "승인",
      rejected: "반려",
      refunded: "환불",
      shipped: "배송중",
      won: "승리",
      lost: "패배",
    }
    return labels[status] || status
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
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

  if (!task) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex h-[90vh]">
            {/* Left Panel - Evidence */}
            <div className="w-1/2 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
              <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-semibold">
                      티켓 #{task.ticket_no || task.id.substring(0, 8).toUpperCase()}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {task.customer
                        ? `${task.customer.member_number} - ${task.customer.name}`
                        : "회원 정보 없음"}
                    </DialogDescription>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>관리자 메뉴</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleStatusChange("assigned")}>
                          상태: 배당됨
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
                          상태: 진행중
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                          상태: 완료
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {employees.map((employee) => (
                          <DropdownMenuItem
                            key={employee.id}
                            onClick={() => handleAssigneeChange(employee.id)}
                          >
                            담당자: {employee.name || employee.username}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* OCR 원본 편지 이미지 */}
                {task.image_url && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      원본 편지 이미지
                    </Label>
                    <div className="relative border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                      <img
                        src={task.image_url}
                        alt="편지 원본"
                        className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImageZoom(true)}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setImageScale(Math.min(imageScale + 0.1, 2))}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setImageScale(Math.max(imageScale - 0.1, 0.5))}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI 추출 텍스트 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI 추출 텍스트
                  </Label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                    <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-50 font-sans">
                      {task.description || task.ai_summary || "추출된 텍스트가 없습니다."}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Status & Chat */}
            <div className="w-1/2 flex flex-col overflow-hidden">
              <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-800">
                <DialogTitle className="text-lg font-semibold">상태 및 커뮤니케이션</DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Task Items 리스트 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    작업 항목
                  </Label>
                  {loadingItems ? (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
                  ) : taskItems.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                      작업 항목이 없습니다.
                    </div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">구분</TableHead>
                            <TableHead>내용</TableHead>
                            <TableHead className="w-[100px] text-right">금액</TableHead>
                            <TableHead className="w-[100px]">상태</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taskItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {getCategoryLabel(item.category)}
                              </TableCell>
                              <TableCell className="text-sm">{item.description}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatNumber(item.amount)}P
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}
                                >
                                  {getStatusLabel(item.status)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* 직원 댓글 (업무 메모) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    업무 메모 (직원간)
                  </Label>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-[200px] overflow-y-auto space-y-3">
                    {loadingComments ? (
                      <div className="text-center p-4 text-gray-500 dark:text-gray-400">로딩 중...</div>
                    ) : comments.filter((c) => c.comment_type === "internal").length === 0 ? (
                      <div className="text-center p-4 text-gray-500 dark:text-gray-400">
                        메모가 없습니다.
                      </div>
                    ) : (
                      comments
                        .filter((c) => c.comment_type === "internal")
                        .map((comment) => (
                          <div key={comment.id} className="border-b border-gray-200 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                {comment.user?.name || comment.user?.username || "알 수 없음"}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {comment.comment}
                            </p>
                          </div>
                        ))
                    )}
                  </div>

                  {/* 직원 댓글 입력 */}
                  {currentUserId && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="업무 메모를 입력하세요..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="border-gray-300 dark:border-gray-700 resize-none text-sm"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handlePostComment()
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handlePostComment}
                          disabled={!newComment.trim() || postingComment}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          {postingComment ? "등록 중..." : "메모 등록"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 고객 답신 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    고객 답신
                  </Label>
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 max-h-[200px] overflow-y-auto space-y-3">
                    {loadingComments ? (
                      <div className="text-center p-4 text-gray-500 dark:text-gray-400">로딩 중...</div>
                    ) : comments.filter((c) => c.comment_type === "customer_reply").length === 0 ? (
                      <div className="text-center p-4 text-gray-500 dark:text-gray-400">
                        답신이 없습니다.
                      </div>
                    ) : (
                      comments
                        .filter((c) => c.comment_type === "customer_reply")
                        .map((comment) => (
                          <div key={comment.id} className="border-b border-blue-200 dark:border-blue-800 pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                {comment.user?.name || comment.user?.username || "알 수 없음"}
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                              {comment.comment}
                            </p>
                          </div>
                        ))
                    )}
                  </div>

                  {/* 고객 답신 입력 */}
                  {currentUserId && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="고객에게 보낼 답신을 작성하세요..."
                        value={newCustomerReply}
                        onChange={(e) => setNewCustomerReply(e.target.value)}
                        className="border-blue-300 dark:border-blue-700 resize-none"
                        rows={5}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handlePostCustomerReply()
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handlePostCustomerReply}
                          disabled={!newCustomerReply.trim() || postingReply}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {postingReply ? "등록 중..." : "답신 등록"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지 확대 다이얼로그 */}
      {task.image_url && (
        <Dialog open={imageZoom} onOpenChange={setImageZoom}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-0">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => setImageZoom(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={task.image_url}
                alt="편지 원본 (확대)"
                className="w-full h-auto"
                style={{ transform: `scale(${imageScale})`, transformOrigin: "top left" }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
