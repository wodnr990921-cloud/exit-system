"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
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
import { X, UserPlus, CheckCircle2, ZoomIn, ImageIcon } from "lucide-react"

interface Task {
  id: string
  ticket_no?: string
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
  letters?: Array<{
    id: string
    file_path: string
    file_name: string
    ocr_summary: string | null
    ocr_image_type: string | null
    created_at: string
  }>
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
  const [savingReply, setSavingReply] = useState(false)
  const [savedReplies, setSavedReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)

  // 이미지 확대 state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageZoom, setImageZoom] = useState(1)

  // 신규 회원 등록 state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerMemberNumber, setNewCustomerMemberNumber] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")

  // 현재 사용자 및 티켓 삭제
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingTask, setDeletingTask] = useState(false)

  // 일괄 삭제
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadCurrentUser()
    loadAllTasks()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch()
    } else {
      setTasks(allTasks)
    }
  }, [searchQuery, searchType, allTasks])

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      console.log("🔍 Auth User:", user?.id)
      
      if (user) {
        const { data: userData, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single()
        
        console.log("👤 User Data:", userData)
        console.log("🎭 User Role:", userData?.role)
        
        if (error) {
          console.error("❌ Error fetching user data:", error)
        }
        
        setCurrentUser(userData)
      }
    } catch (error) {
      console.error("Error loading current user:", error)
    }
  }

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
    // Load task with letters
    try {
      const { data: taskWithLetters, error } = await supabase
        .from("tasks")
        .select(`
          *,
          customer:customers(member_number, name, institution, prison_number),
          user:users!tasks_user_id_fkey(name, username),
          assigned_to_user:users!tasks_assigned_to_fkey(name, username),
          items:task_items(*),
          letters:letters!letters_task_id_fkey(id, file_path, file_name, ocr_summary, ocr_image_type, created_at)
        `)
        .eq("id", task.id)
        .single()

      if (error) throw error

      console.log('✅ Task loaded:', {
        taskId: taskWithLetters.id,
        ticketNo: taskWithLetters.ticket_no,
        lettersCount: taskWithLetters.letters?.length || 0,
        letters: taskWithLetters.letters
      })

      setSelectedTask(taskWithLetters as Task)
    } catch (error) {
      console.error("❌ Error loading task details:", error)
      
      // Fallback: Try to load letters separately
      try {
        const { data: letters, error: lettersError } = await supabase
          .from("letters")
          .select("id, file_path, file_name, ocr_summary, ocr_image_type, created_at")
          .eq("task_id", task.id)
        
        console.log('🔍 Fallback letters query:', {
          taskId: task.id,
          lettersFound: letters?.length || 0,
          letters: letters,
          error: lettersError
        })
        
        if (!lettersError && letters) {
          setSelectedTask({ ...task, letters: letters as any[] } as Task)
        } else {
          setSelectedTask(task)
        }
      } catch (fallbackError) {
        console.error("❌ Fallback letters query failed:", fallbackError)
        setSelectedTask(task)
      }
    }

    setIsTaskDialogOpen(true)
    await loadTaskComments(task.id)
    await loadSavedReplies(task.id)
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

  const loadSavedReplies = async (taskId: string) => {
    setLoadingReplies(true)
    try {
      console.log("📋 저장된 답변 로딩 중...", taskId)
      const { data, error } = await supabase
        .from("task_items")
        .select("*")
        .eq("task_id", taskId)
        .eq("category", "inquiry")
        .order("created_at", { ascending: false })

      if (error) throw error
      console.log("✅ 저장된 답변:", data?.length || 0, "개")
      setSavedReplies(data || [])
    } catch (error: any) {
      console.error("❌ 답변 로딩 오류:", error)
      setSavedReplies([])
    } finally {
      setLoadingReplies(false)
    }
  }

  // 신규 회원 등록
  const handleRegisterNewCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerMemberNumber.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "이름과 회원번호는 필수입니다.",
      })
      return
    }

    if (!selectedTask) return

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

      // Update task with new customer
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          customer_id: newCustomer.id,
          member_id: newCustomer.id,
        })
        .eq("id", selectedTask.id)

      if (updateError) throw updateError

      // Reload task
      await handleTaskClick(selectedTask)

      setShowNewCustomerForm(false)
      setNewCustomerName("")
      setNewCustomerMemberNumber("")
      setNewCustomerPhone("")
      setNewCustomerAddress("")

      toast({
        title: "회원 등록 완료",
        description: `${newCustomer.name} (${newCustomer.member_number}) 회원이 등록되고 티켓에 연결되었습니다.`,
      })
    } catch (error: any) {
      console.error("Register customer error:", error)
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message || "회원 등록 중 오류가 발생했습니다.",
      })
    }
  }

  // 티켓 삭제 (대표/관리자만)
  const handleDeleteTask = async () => {
    if (!selectedTask) return

    setDeletingTask(true)
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", selectedTask.id)

      if (error) throw error

      toast({
        title: "티켓 삭제 완료",
        description: `티켓 #${selectedTask.ticket_no || selectedTask.id.slice(0, 8)}이(가) 삭제되었습니다.`,
      })

      // Close dialogs and reload tasks
      setIsDeleteDialogOpen(false)
      setIsTaskDialogOpen(false)
      setSelectedTask(null)
      await loadAllTasks()
    } catch (error: any) {
      console.error("Delete task error:", error)
      toast({
        variant: "destructive",
        title: "삭제 오류",
        description: error.message || "티켓 삭제 중 오류가 발생했습니다.",
      })
    } finally {
      setDeletingTask(false)
    }
  }

  // 티켓 선택/해제
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  // 전체 선택/해제
  const toggleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(tasks.map(t => t.id))
    }
  }

  // 답변 일괄 출력
  const handlePrintReplies = async () => {
    try {
      const { data, error } = await supabase
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

      if (!data || data.length === 0) {
        toast({
          title: "알림",
          description: "출력할 답변이 없습니다.",
        })
        return
      }

      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast({
          title: "오류",
          description: "팝업이 차단되었습니다. 팝업 차단을 해제해주세요.",
          variant: "destructive",
        })
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
      @page { margin: 2cm; }
      .page-break { page-break-after: always; }
    }
    body {
      font-family: 'Malgun Gothic', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #333;
    }
    .header h1 {
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .reply-item {
      margin-bottom: 40px;
      padding: 20px;
      border: 2px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }
    .recipient-address {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      padding: 10px;
      background: #fff;
      border-left: 4px solid #4CAF50;
    }
    .reply-header {
      display: flex;
      justify-between;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    .ticket-info {
      font-weight: bold;
      color: #333;
    }
    .customer-info {
      color: #666;
      font-size: 14px;
    }
    .date {
      color: #999;
      font-size: 12px;
    }
    .reply-content {
      line-height: 1.8;
      font-size: 14px;
      white-space: pre-wrap;
      padding: 15px;
      background: white;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📮 회원 답변 일괄 출력</h1>
    <p>출력 일시: ${new Date().toLocaleString("ko-KR")}</p>
    <p>총 ${data.length}건</p>
  </div>
  ${data
    .map(
      (item: any, index: number) => `
    <div class="reply-item ${index < data.length - 1 ? "page-break" : ""}">
      <div class="recipient-address">
        ${item.task?.customer?.address || "주소 없음"} ${item.task?.customer?.name || "미등록"}
      </div>
      <div class="reply-header">
        <div>
          <div class="ticket-info">티켓 #${item.task?.ticket_no || "N/A"}</div>
          <div class="customer-info">${item.task?.customer?.name || "미등록"} (${item.task?.customer?.member_number || "-"})</div>
        </div>
        <div class="date">${new Date(item.created_at).toLocaleString("ko-KR")}</div>
      </div>
      <div class="reply-content">${item.description || ""}</div>
    </div>
  `
    )
    .join("")}
</body>
</html>
      `

      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 250)

      toast({
        title: "출력 준비 완료",
        description: `${data.length}건의 답변이 출력 대기 중입니다.`,
      })
    } catch (error: any) {
      console.error("Print error:", error)
      toast({
        variant: "destructive",
        title: "출력 오류",
        description: error.message || "답변 출력 중 오류가 발생했습니다.",
      })
    }
  }

  // 일괄 삭제
  const handleBatchDelete = async () => {
    if (selectedTaskIds.length === 0) return

    setBatchDeleting(true)
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .in("id", selectedTaskIds)

      if (error) throw error

      toast({
        title: "일괄 삭제 완료",
        description: `${selectedTaskIds.length}개의 티켓이 삭제되었습니다.`,
      })

      // Reset and reload
      setSelectedTaskIds([])
      setIsBatchDeleteDialogOpen(false)
      await loadAllTasks()
    } catch (error: any) {
      console.error("Batch delete error:", error)
      toast({
        variant: "destructive",
        title: "삭제 오류",
        description: error.message || "일괄 삭제 중 오류가 발생했습니다.",
      })
    } finally {
      setBatchDeleting(false)
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
      pending: "⏳ 대기중",
      draft: "📝 작성중",
      assigned: "📋 접수완료",
      in_progress: "⚙️ 처리중",
      completed: "✅ 완료",
      pending_review: "🔍 검토중",
      closed: "🔒 마감",
    }
    return labels[status] || `❓ ${status}`
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-2 border-gray-300 dark:border-gray-600",
      draft: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-600",
      assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-2 border-blue-400 dark:border-blue-600",
      in_progress: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 border-2 border-amber-400 dark:border-amber-600 animate-pulse",
      completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100 border-2 border-emerald-400 dark:border-emerald-600",
      pending_review: "bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100 border-2 border-purple-400 dark:border-purple-600",
      closed: "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 border-2 border-red-400 dark:border-red-600",
    }
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-2 border-gray-300"
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
          <div className="flex gap-2">
            <Button 
              onClick={handlePrintReplies} 
              variant="outline"
              className="bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400"
            >
              📮 답변 일괄 출력
            </Button>
            <Button onClick={() => router.push("/dashboard/reception")} className="bg-blue-600 hover:bg-blue-700">
              + 신규 티켓 작성
            </Button>
          </div>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">티켓 목록</CardTitle>
                <CardDescription>
                  총 {tasks.length}개의 티켓
                  {selectedTaskIds.length > 0 && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                      ({selectedTaskIds.length}개 선택됨)
                    </span>
                  )}
                </CardDescription>
              </div>
              
              {/* 관리자 전용: 일괄 삭제 버튼 */}
              {currentUser && (currentUser.role === "ceo" || currentUser.role === "admin") && (
                <div className="flex items-center gap-3">
                  {selectedTaskIds.length > 0 && (
                    <>
                      <Button
                        onClick={toggleSelectAll}
                        variant="outline"
                        size="sm"
                        className="text-gray-900 dark:text-gray-100"
                      >
                        {selectedTaskIds.length === tasks.length ? "전체 해제" : "전체 선택"}
                      </Button>
                      <Button
                        onClick={() => setIsBatchDeleteDialogOpen(true)}
                        variant="destructive"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        🗑️ {selectedTaskIds.length}개 삭제
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">티켓이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(task.id)
                  const showCheckbox = currentUser && (currentUser.role === "ceo" || currentUser.role === "admin")
                  
                  // 상태별 카드 테두리 색상
                  const getCardBorderColor = (status: string) => {
                    if (isSelected) return "border-blue-500 ring-4 ring-blue-200 dark:ring-blue-800"
                    
                    const borderColors: Record<string, string> = {
                      pending: "border-gray-300 dark:border-gray-700 hover:border-gray-400",
                      in_progress: "border-amber-300 dark:border-amber-700 hover:border-amber-400 shadow-amber-100",
                      completed: "border-emerald-300 dark:border-emerald-700 hover:border-emerald-400",
                      closed: "border-red-300 dark:border-red-700 hover:border-red-400",
                    }
                    return borderColors[status] || "border-gray-200 dark:border-gray-800 hover:border-blue-400"
                  }
                  
                  return (
                    <Card
                      key={task.id}
                      className={`cursor-pointer hover:shadow-xl transition-all duration-200 border-3 bg-white dark:bg-gray-900 ${getCardBorderColor(task.status)}`}
                      onClick={() => handleTaskClick(task)}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          {/* 첫 줄: (체크박스) (상태) (반송) (기관수번이름) (날짜) */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* 관리자 전용: 체크박스 */}
                            {showCheckbox && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleTaskSelection(task.id)
                                }}
                                className="flex items-center"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                            )}
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

                          {/* 회원 정보 */}
                          {task.customer && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                              <span className="text-xs text-gray-500 dark:text-gray-500 font-semibold">회원:</span>
                              <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                                {task.customer.institution && task.customer.prison_number
                                  ? `${task.customer.institution} ${task.customer.prison_number} ${task.customer.name}`
                                  : task.customer.name || "-"}
                              </span>
                            </div>
                          )}

                          {/* 날짜 */}
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 ml-auto">
                            <span className="text-xs text-gray-500 dark:text-gray-500 font-semibold">등록:</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100">
                              {formatDate(task.created_at)}
                            </span>
                          </div>
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
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          {/* 담당직원 */}
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">담당:</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
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
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-semibold ${
                              task.amount > 0
                                ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                                : task.amount < 0
                                ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-400"
                            }`}>
                              <span className="text-xs font-semibold opacity-75">
                                {task.point_category ? `${task.point_category}:` : "금액:"}
                              </span>
                              <span className="text-sm">
                                {task.amount > 0 ? "+" : ""}{formatNumber(task.amount)}원
                              </span>
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
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 티켓 상세 다이얼로그 */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  🎫 티켓 상세 정보
                </DialogTitle>
                {selectedTask && (
                  <div className="flex items-center gap-2">
                    <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getStatusColor(selectedTask.status)}`}>
                      {getStatusLabel(selectedTask.status)}
                    </span>
                    <span className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono font-bold text-gray-900 dark:text-gray-100">
                      #{selectedTask.ticket_no || selectedTask.id.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
              <DialogDescription className="text-base">
                {selectedTask?.customer?.name && (
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    👤 {selectedTask.customer.name}
                  </span>
                )}
                {selectedTask?.customer?.member_number && (
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    ({selectedTask.customer.member_number})
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedTask && (
              <div className="space-y-4 py-4">
                {/* 좌우 분할 레이아웃 */}
                <div className="grid grid-cols-2 gap-6">
                  {/* 좌측: 편지 사진 + 전체 내용 */}
                  <div className="space-y-4">
                    {/* 편지 사진 */}
                    <div className="space-y-2">
                      <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📷 편지 사진</Label>
                      </div>
                      {selectedTask.letters && selectedTask.letters.length > 0 ? (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                          {selectedTask.letters.map((letter) => {
                            const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/letters/${letter.file_path}`
                            return (
                              <div key={letter.id} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-blue-400 transition-colors">
                                <img
                                  src={imageUrl}
                                  alt={letter.file_name}
                                  className="w-full max-h-[150px] object-contain bg-gray-50 dark:bg-gray-900 cursor-pointer"
                                  onClick={() => setSelectedImage(imageUrl)}
                                />
                                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <ZoomIn className="w-3 h-3" />
                                  확대
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[150px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                          <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">편지 사진이 없습니다</p>
                        </div>
                      )}
                    </div>

                    {/* 전체 내용 (글자 제한 없음) */}
                    <div className="space-y-2">
                      <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📄 전체 내용</Label>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                          {selectedTask.description || "내용이 없습니다."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 우측: 요약 정보 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                          <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">🎫 티켓번호</Label>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">{formatTaskId(selectedTask.id)}</p>
                      </div>
                      <div>
                        <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                          <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📌 상태</Label>
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                            {getStatusLabel(selectedTask.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">👤 회원</Label>
                      </div>
                      {selectedTask.customer ? (
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                          {selectedTask.customer.member_number} - {selectedTask.customer.name}
                        </p>
                      ) : (
                        <div className="mt-1 space-y-2">
                          <p className="text-sm text-red-600 dark:text-red-400">미등록 회원</p>
                          {!showNewCustomerForm && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowNewCustomerForm(true)}
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              신규 회원 등록
                            </Button>
                          )}
                          {showNewCustomerForm && (
                            <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-green-900 dark:text-green-100">✨ 신규 회원 등록</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowNewCustomerForm(false)}
                                  className="h-5 w-5 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="space-y-1.5">
                                <div>
                                  <Label className="text-xs">이름 *</Label>
                                  <Input
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                    placeholder="홍길동"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">회원번호 *</Label>
                                  <Input
                                    value={newCustomerMemberNumber}
                                    onChange={(e) => setNewCustomerMemberNumber(e.target.value)}
                                    placeholder="M001"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">전화번호</Label>
                                  <Input
                                    value={newCustomerPhone}
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    placeholder="010-1234-5678"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">주소</Label>
                                  <Input
                                    value={newCustomerAddress}
                                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                                    placeholder="서울시..."
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <Button
                                  onClick={handleRegisterNewCustomer}
                                  className="w-full h-7 bg-green-600 hover:bg-green-700 text-white text-xs"
                                  size="sm"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  회원 등록 및 연결
                                </Button>
                              </div>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">👨‍💼 담당자</Label>
                      </div>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                        {selectedTask.assigned_to_user?.name || selectedTask.assigned_to_user?.username || "-"}
                      </p>
                    </div>

                    <div>
                      <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md mb-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📅 등록일시</Label>
                      </div>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-50">{formatDate(selectedTask.created_at)}</p>
                    </div>

                    <div>
                      <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md mb-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">📋 제목</Label>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">{selectedTask.title}</p>
                    </div>

                    {/* 요약 정보 */}
                    <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="inline-block px-3 py-1 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                        <Label className="text-sm font-bold text-blue-900 dark:text-blue-100">📊 요약 정보</Label>
                      </div>
                      
                      {/* 카테고리 */}
                      {selectedTask.category && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">🏷️ 카테고리:</span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100">
                            {selectedTask.category}
                          </span>
                        </div>
                      )}
                      
                      {/* 요약/요청사항 */}
                      <div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-2">💬 요청사항:</span>
                        <p className="text-sm text-gray-800 dark:text-gray-200 p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-blue-100 dark:border-blue-900 leading-relaxed">
                          {selectedTask.summary || selectedTask.description?.substring(0, 200) || "요약 정보가 없습니다."}
                          {selectedTask.description && selectedTask.description.length > 200 && "..."}
                        </p>
                      </div>
                      
                      {/* OCR 정보 */}
                      {selectedTask.letters && selectedTask.letters.some(l => l.ocr_summary) && (
                        <div>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-2">🔍 OCR 인식:</span>
                          <div className="space-y-1">
                            {selectedTask.letters
                              .filter(l => l.ocr_summary)
                              .map((letter, idx) => (
                                <p key={letter.id} className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-white/50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                                  • {letter.ocr_summary}
                                </p>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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

                {/* 저장된 답변 목록 (댓글 형식) */}
                {savedReplies.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                      <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        💬 저장된 답변 ({savedReplies.length}개)
                      </Label>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {savedReplies.map((reply, index) => (
                        <div 
                          key={reply.id}
                          className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          {/* 아바타/아이콘 */}
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              ✍️
                            </div>
                          </div>
                          
                          {/* 답변 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                답변 #{index + 1}
                              </span>
                              {reply.status === "approved" && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold">
                                  ✅ 승인
                                </span>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                                {new Date(reply.created_at).toLocaleString("ko-KR", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {reply.description}
                            </p>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {reply.description.length}자
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      if (!selectedTask || !taskReplyText.trim() || savingReply) return

                      console.log("💾 [답변 저장] 시작:", {
                        taskId: selectedTask.id,
                        replyLength: taskReplyText.trim().length
                      })

                      setSavingReply(true)
                      try {
                        // Insert reply as task_item
                        console.log("📝 task_items에 답변 저장 중...")
                        const { data: insertData, error } = await supabase.from("task_items").insert({
                          task_id: selectedTask.id,
                          category: "inquiry",
                          description: taskReplyText.trim(),
                          amount: 0,
                          status: "approved",
                        }).select()

                        if (error) {
                          console.error("❌ task_items 저장 실패:", error)
                          throw error
                        }

                        console.log("✅ task_items 저장 성공:", insertData)

                        // Update task status to in_progress (only if pending)
                        console.log("🔄 티켓 상태 업데이트 중...")
                        console.log("📊 현재 티켓 상태:", selectedTask.status)
                        
                        let shouldUpdateStatus = false
                        let newStatus = selectedTask.status
                        
                        // Only change status if currently pending
                        if (selectedTask.status === "pending") {
                          shouldUpdateStatus = true
                          newStatus = "in_progress"
                          console.log("✅ 상태 변경: pending → in_progress")
                        } else {
                          console.log("ℹ️ 상태 유지:", selectedTask.status)
                        }
                        
                        if (shouldUpdateStatus) {
                          const { error: updateError } = await supabase
                            .from("tasks")
                            .update({ 
                              status: newStatus,
                              updated_at: new Date().toISOString()
                            })
                            .eq("id", selectedTask.id)

                          if (updateError) {
                            console.warn("⚠️ 티켓 상태 업데이트 실패:", updateError)
                          } else {
                            console.log("✅ 티켓 상태 업데이트 성공")
                          }
                        }

                        // Clear input and show success
                        const savedText = taskReplyText.trim()
                        setTaskReplyText("")
                        
                        // Show prominent success message
                        toast({
                          title: "✅ 답변 저장 완료!",
                          description: `${savedText.length}자 답변이 성공적으로 저장되었습니다. 위쪽에서 확인하세요.`,
                        })
                        
                        // Also log to console for visibility
                        console.log("🎉 [답변 저장] 성공 메시지 표시됨")
                        console.log("💾 저장된 답변:", savedText)

                        // Refresh saved replies immediately without full page reload
                        console.log("🔄 답변 목록 새로고침 중...")
                        if (selectedTask) {
                          await loadSavedReplies(selectedTask.id)
                        }
                        console.log("✅ 답변 저장 및 새로고침 완료!")
                      } catch (error: any) {
                        console.error("❌ [답변 저장] 실패:", error)
                        toast({
                          variant: "destructive",
                          title: "❌ 답변 저장 실패",
                          description: error.message || "답변 저장 중 오류가 발생했습니다. F12 콘솔을 확인하세요.",
                        })
                      } finally {
                        setSavingReply(false)
                      }
                    }}
                    disabled={!taskReplyText.trim() || savingReply}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white font-medium"
                  >
                    {savingReply ? "💾 저장 중..." : "💾 답변 저장"}
                  </Button>
                </div>

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
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              <div>
                {(() => {
                  console.log("🔍 Delete Button Check - currentUser:", currentUser)
                  console.log("🔍 Delete Button Check - role:", currentUser?.role)
                  console.log("🔍 Delete Button Check - isCEO:", currentUser?.role === "ceo")
                  console.log("🔍 Delete Button Check - isAdmin:", currentUser?.role === "admin")
                  return null
                })()}
                {currentUser && (currentUser.role === "ceo" || currentUser.role === "admin") && (
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    🗑️ 티켓 삭제
                  </Button>
                )}
              </div>
              <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)} className="border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium">
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 이미지 확대 Dialog */}
        <Dialog 
          open={!!selectedImage} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null)
              setImageZoom(1)
            }
          }}
        >
          <DialogContent className="max-w-7xl max-h-[95vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>편지 사진 확대</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}
                    disabled={imageZoom <= 0.5}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    ➖ 축소
                  </Button>
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
                    {Math.round(imageZoom * 100)}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}
                    disabled={imageZoom >= 3}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    ➕ 확대
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImageZoom(1)}
                    className="text-gray-900 dark:text-gray-100"
                  >
                    🔄 원본
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div 
              className="flex items-center justify-center max-h-[80vh] overflow-auto"
              onWheel={(e) => {
                if (e.ctrlKey) {
                  e.preventDefault()
                  const delta = e.deltaY > 0 ? -0.1 : 0.1
                  setImageZoom(Math.max(0.5, Math.min(3, imageZoom + delta)))
                }
              }}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="편지 확대"
                  className="max-w-full max-h-full object-contain transition-transform cursor-move"
                  style={{ transform: `scale(${imageZoom})` }}
                />
              )}
            </div>
            <DialogFooter className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                💡 Ctrl + 마우스 휠로도 확대/축소 가능
              </span>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedImage(null)
                  setImageZoom(1)
                }} 
                className="text-gray-900 dark:text-gray-100 font-medium"
              >
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 티켓 삭제 확인 Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">⚠️ 티켓 삭제 확인</DialogTitle>
              <DialogDescription>
                정말로 이 티켓을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-2 py-4 border-y border-gray-200 dark:border-gray-700">
                <p className="text-sm">
                  <span className="font-semibold">티켓번호:</span> {selectedTask.ticket_no || selectedTask.id.slice(0, 8)}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">제목:</span> {selectedTask.title}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">회원:</span> {selectedTask.customer?.name || "미등록"}
                </p>
              </div>
            )}
            <DialogFooter className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deletingTask}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteTask}
                disabled={deletingTask}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {deletingTask ? "삭제 중..." : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 일괄 삭제 확인 Dialog */}
        <Dialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">⚠️ 일괄 삭제 확인</DialogTitle>
              <DialogDescription>
                선택한 {selectedTaskIds.length}개의 티켓을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 border-y border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                삭제될 티켓:
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {tasks
                  .filter(t => selectedTaskIds.includes(t.id))
                  .map(task => (
                    <div key={task.id} className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      • {task.ticket_no || task.id.slice(0, 8)} - {task.title}
                    </div>
                  ))}
              </div>
            </div>
            <DialogFooter className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBatchDeleteDialogOpen(false)}
                disabled={batchDeleting}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {batchDeleting ? "삭제 중..." : `${selectedTaskIds.length}개 삭제`}
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
