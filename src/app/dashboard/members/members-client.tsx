"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Flag, X, Users, UserX, UserPlus, Home, DollarSign, Plus, Minus } from "lucide-react"
import dynamic from "next/dynamic"
import { useToast } from "@/hooks/use-toast"

const BlacklistContent = dynamic(() => import("../blacklist/blacklist-client"), {
  loading: () => <div className="p-6">블랙리스트 로딩 중...</div>,
  ssr: false,
})

const InmatesContent = dynamic(() => import("../inmates/inmates-client"), {
  loading: () => <div className="p-6">수용자 관리 로딩 중...</div>,
  ssr: false,
})

interface Customer {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
  normal_points: number
  betting_points: number
  depositor_name: string | null
  mailbox_address: string | null
  total_deposit: number
  total_usage: number
  total_betting: number
  created_at: string
  updated_at: string
  total_point_general?: number
  total_point_betting?: number
  flags?: CustomerFlag[]
}

interface CustomerFlag {
  id: string
  flag_type: string
  reason: string
  created_at: string
  created_by: string
  user?: {
    name: string | null
    username: string
  }
}

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
}

interface TaskComment {
  id: string
  comment: string
  created_at: string
  user_id: string
  user: {
    name: string | null
    username: string
  } | null
}

export default function MembersClient() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("members")
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [taskCount, setTaskCount] = useState(0)
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [customerTasksMap, setCustomerTasksMap] = useState<Map<string, Task[]>>(new Map())
  const [customerTaskCounts, setCustomerTaskCounts] = useState<Map<string, number>>(new Map())

  // 플래그 관련 상태
  const [showFlagDialog, setShowFlagDialog] = useState(false)
  const [flagType, setFlagType] = useState<"blacklist" | "warning">("blacklist")
  const [flagReason, setFlagReason] = useState("")
  const [addingFlag, setAddingFlag] = useState(false)

  // 신규회원 추가 관련 상태
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    institution: "",
    prison_number: "",
    phone: "",
    depositor_name: "",
    mailbox_address: "",
    normal_points: 0,
    betting_points: 0,
  })

  // 포인트 지급/차감 관련 상태
  const [showPointDialog, setShowPointDialog] = useState(false)
  const [pointAction, setPointAction] = useState<"charge" | "use">("charge")
  const [pointCategory, setPointCategory] = useState<"general" | "betting">("general")
  const [pointAmount, setPointAmount] = useState("")
  const [pointNote, setPointNote] = useState("")
  const [processingPoint, setProcessingPoint] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch()
    } else {
      setFilteredCustomers(customers)
      setSelectedCustomer(null)
      setTasks([])
      setTaskCount(0)
    }
  }, [searchQuery, customers])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setCustomers(data || [])
      setFilteredCustomers(data || [])
    } catch (error: any) {
      console.error("Error loading customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateMemberNumber = async (): Promise<string> => {
    // 날짜 기반 회원번호 생성 (YYYYMMDD + 순번)
    const today = new Date()
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    
    // 오늘 날짜로 시작하는 회원번호 중 최대값 찾기
    const { data: existingMembers } = await supabase
      .from("customers")
      .select("member_number")
      .like("member_number", `${datePrefix}%`)
      .order("member_number", { ascending: false })
      .limit(1)

    if (existingMembers && existingMembers.length > 0) {
      const lastNumber = existingMembers[0].member_number
      const lastSequence = parseInt(lastNumber.slice(-3)) || 0
      const newSequence = lastSequence + 1
      return `${datePrefix}${String(newSequence).padStart(3, "0")}`
    } else {
      return `${datePrefix}001`
    }
  }

  // 포인트 지급/차감 처리
  const handlePointTransaction = async () => {
    if (!selectedCustomer) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "회원을 선택해주세요.",
      })
      return
    }

    if (!pointAmount || parseFloat(pointAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "유효한 금액을 입력해주세요.",
      })
      return
    }

    setProcessingPoint(true)
    try {
      // pending 상태로 points 테이블에 insert
      const amount = pointAction === "use" ? -Math.abs(parseFloat(pointAmount)) : Math.abs(parseFloat(pointAmount))

      const { error } = await supabase.from("points").insert([
        {
          customer_id: selectedCustomer.id,
          amount: amount,
          type: pointAction,
          category: pointCategory,
          status: "pending",
          note: pointNote.trim() || null,
        },
      ])

      if (error) throw error

      toast({
        title: "성공",
        description: `포인트 ${pointAction === "charge" ? "지급" : "차감"} 요청이 등록되었습니다. 재무관리에서 승인해주세요.`,
      })

      // 다이얼로그 초기화 및 닫기
      setShowPointDialog(false)
      setPointAmount("")
      setPointNote("")
      setPointAction("charge")
      setPointCategory("general")
    } catch (error: any) {
      console.error("Point transaction error:", error)
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message || "포인트 처리 중 오류가 발생했습니다.",
      })
    } finally {
      setProcessingPoint(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // 회원번호 자동 생성
      const autoMemberNumber = await generateMemberNumber()
      
      const customerData = {
        member_number: autoMemberNumber,
        name: newCustomer.name,
        institution: newCustomer.institution || null,
        prison_number: newCustomer.prison_number || null,
        depositor_name: newCustomer.depositor_name || null,
        mailbox_address: newCustomer.mailbox_address || null,
        normal_points: newCustomer.normal_points || 0,
        betting_points: newCustomer.betting_points || 0,
        total_deposit: 0,
        total_usage: 0,
        total_betting: 0,
      }

      const { data, error } = await supabase.from("customers").insert([customerData]).select()

      if (error) throw error

      setSuccess(`회원이 성공적으로 생성되었습니다. (회원번호: ${autoMemberNumber})`)
      setNewCustomer({
        name: "",
        institution: "",
        prison_number: "",
        phone: "",
        depositor_name: "",
        mailbox_address: "",
        normal_points: 0,
        betting_points: 0,
      })
      setShowCreateDialog(false)
      loadCustomers()
      
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "회원 생성에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers)
      setSelectedCustomer(null)
      setTasks([])
      setTaskCount(0)
      return
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`member_number.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(10)

      if (error) throw error

      setFilteredCustomers(data || [])
      
      if (data && data.length > 0) {
        const customer = data[0]
        setSelectedCustomer(customer)
        await loadCustomerTasks(customer.id)
      } else {
        setSelectedCustomer(null)
        setTasks([])
        setTaskCount(0)
      }
    } catch (error: any) {
      console.error("Error searching customer:", error)
    }
  }

  const handleCustomerClick = async (customer: Customer) => {
    // 같은 회원을 다시 클릭하면 선택 해제
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null)
      setSearchQuery("")
      setTasks([])
      setTaskCount(0)
      return
    }

    console.log("회원 선택:", customer.name, customer.id)
    setSelectedCustomer(customer)
    setSearchQuery(`${customer.member_number} - ${customer.name}`)
    console.log("티켓 로딩 시작...")
    try {
      await loadCustomerTasks(customer.id)
      console.log("티켓 로딩 완료")
    } catch (error) {
      console.error("티켓 로딩 실패:", error)
    }
  }

  // 미등록 회원 삭제
  const handleDeleteUnregisteredCustomer = async (customerId: string, memberNumber: string, e: React.MouseEvent) => {
    e.stopPropagation() // 행 클릭 이벤트 방지

    if (!confirm(`정말로 미등록 회원 (${memberNumber})을(를) 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)

      if (error) throw error

      setSuccess(`미등록 회원 (${memberNumber})이(가) 삭제되었습니다.`)
      await loadCustomers() // 목록 새로고침
    } catch (error: any) {
      console.error("회원 삭제 실패:", error)
      setError(`회원 삭제 실패: ${error.message}`)
    }
  }

  const handleCustomerRowClick = async (customer: Customer) => {
    const isExpanded = expandedCustomers.has(customer.id)
    if (isExpanded) {
      // 축소
      const newExpanded = new Set(expandedCustomers)
      newExpanded.delete(customer.id)
      setExpandedCustomers(newExpanded)
    } else {
      // 확장 - 최근 티켓만 로드
      const newExpanded = new Set(expandedCustomers)
      newExpanded.add(customer.id)
      setExpandedCustomers(newExpanded)
      await loadCustomerRecentTasks(customer.id)
    }
  }

  const handleCustomerNameClick = async (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCustomer(customer)
    setSearchQuery(`${customer.member_number} - ${customer.name}`)
    await loadCustomerTasks(customer.id)
  }
  
  const loadCustomerRecentTasks = async (customerId: string) => {
    try {
      // 티켓 개수 조회
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)

      const newCounts = new Map(customerTaskCounts)
      newCounts.set(customerId, count || 0)
      setCustomerTaskCounts(newCounts)

      // 최근 티켓 5건만 조회
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          task_comments (id)
        `
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) throw error

      // 각 티켓에 댓글 수 추가 및 요약 생성
      const tasksWithSummary = await Promise.all(
        (data || []).map(async (task) => {
          const commentCount = task.task_comments?.length || 0

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

          return {
            ...task,
            comment_count: commentCount,
            summary: summary || task.description?.substring(0, 100) || "",
          }
        })
      )

      const newTasksMap = new Map(customerTasksMap)
      newTasksMap.set(customerId, tasksWithSummary)
      setCustomerTasksMap(newTasksMap)
    } catch (error: any) {
      console.error("Error loading customer recent tasks:", error)
    }
  }

  const loadCustomerFlags = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/flags`)
      const data = await response.json()

      if (data.success && selectedCustomer) {
        setSelectedCustomer({
          ...selectedCustomer,
          flags: data.flags || []
        })
      }
    } catch (error) {
      console.error("Error loading customer flags:", error)
    }
  }

  const handleAddFlag = async () => {
    if (!selectedCustomer || !flagReason.trim()) {
      setError("플래그 사유를 입력해주세요.")
      return
    }

    setAddingFlag(true)
    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_type: flagType,
          reason: flagReason.trim()
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("플래그가 추가되었습니다.")
        setShowFlagDialog(false)
        setFlagReason("")
        await loadCustomerFlags(selectedCustomer.id)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || "플래그 추가에 실패했습니다.")
      }
    } catch (error) {
      console.error("Error adding flag:", error)
      setError("플래그 추가 중 오류가 발생했습니다.")
    } finally {
      setAddingFlag(false)
    }
  }

  const handleRemoveFlag = async (flagId: string) => {
    if (!selectedCustomer) return

    if (!confirm("정말 이 플래그를 제거하시겠습니까?")) return

    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/flags/${flagId}`, {
        method: "DELETE"
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("플래그가 제거되었습니다.")
        await loadCustomerFlags(selectedCustomer.id)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || "플래그 제거에 실패했습니다.")
      }
    } catch (error) {
      console.error("Error removing flag:", error)
      setError("플래그 제거 중 오류가 발생했습니다.")
    }
  }

  const loadCustomerTasks = async (customerId: string) => {
    setLoadingTasks(true)
    try {
      // 티켓 개수 조회
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)

      setTaskCount(count || 0)

      // 플래그도 같이 로드
      await loadCustomerFlags(customerId)

      // 티켓 목록 조회
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          task_comments (id)
        `
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })

      if (error) throw error

      // 각 티켓에 댓글 수 추가 및 요약 생성
      const tasksWithSummary = await Promise.all(
        (data || []).map(async (task) => {
          const commentCount = task.task_comments?.length || 0

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

          return {
            ...task,
            comment_count: commentCount,
            summary: summary || task.description?.substring(0, 100) || "",
          }
        })
      )

      setTasks(tasksWithSummary)
    } catch (error: any) {
      console.error("Error loading tasks:", error)
    } finally {
      setLoadingTasks(false)
    }
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

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "대기",
      assigned: "접수",
      in_progress: "처리중",
      completed: "완료",
      pending_review: "검토 대기",
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

  const getAmountColor = (amount: number | null, pointCategory: string | null) => {
    if (!amount) return "text-gray-500 dark:text-gray-400"
    if (pointCategory === "배팅") {
      return amount > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-blue-500 dark:text-blue-400 font-medium"
    } else {
      return amount > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 및 네비게이션 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              회원관리
            </h1>
            <p className="text-muted-foreground mt-2">
              회원, 수용자, 블랙리스트를 한 곳에서 관리합니다
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Button>
        </div>

        {/* Tabs - 회원관리 + 수용자관리 + 블랙리스트 통합 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              <span>회원관리</span>
            </TabsTrigger>
            <TabsTrigger value="inmates" className="gap-2">
              <Users className="h-4 w-4" />
              <span>수용자 관리</span>
            </TabsTrigger>
            <TabsTrigger value="blacklist" className="gap-2">
              <UserX className="h-4 w-4" />
              <span>블랙리스트</span>
            </TabsTrigger>
          </TabsList>

          {/* Members Tab Content */}
          <TabsContent value="members" className="space-y-6">
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowPointDialog(true)}
                variant={selectedCustomer ? "default" : "outline"}
                className={selectedCustomer
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-gray-300 text-gray-400 cursor-not-allowed"
                }
                disabled={!selectedCustomer}
                title={selectedCustomer
                  ? `${selectedCustomer.name} 회원의 포인트를 지급하거나 차감합니다`
                  : "좌측 회원 목록에서 체크박스를 선택해주세요"
                }
              >
                <DollarSign className="h-4 w-4 mr-2" />
                포인트 지급/차감
                {selectedCustomer && (
                  <Badge variant="secondary" className="ml-2 bg-white/20">
                    {selectedCustomer.name}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
                title="모든 직원이 신규 회원을 등록할 수 있습니다"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                신규회원 추가
              </Button>
            </div>

        {/* 회원 조회 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">회원조회</CardTitle>
            <CardDescription>회원번호 또는 이름으로 검색하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="회원번호 또는 이름 입력"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
              />
              <Button onClick={handleSearch} disabled={!searchQuery.trim()} className="bg-blue-600 hover:bg-blue-700">
                조회
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 회원 목록 */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">회원목록</CardTitle>
            <CardDescription>총 {filteredCustomers.length}명</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center p-12 text-gray-500 dark:text-gray-400">회원이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-center p-4 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">선택</th>
                      <th className="text-left p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">회원번호</th>
                      <th className="text-left p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">이름</th>
                      <th className="text-left p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">상태</th>
                      <th className="text-left p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">수용기관</th>
                      <th className="text-left p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">수용번호</th>
                      <th className="text-right p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">일반 포인트</th>
                      <th className="text-right p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">배팅 포인트</th>
                      <th className="text-center p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className={`border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${
                          selectedCustomer?.id === customer.id ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        <td className="p-4 text-center">
                          <Checkbox
                            checked={selectedCustomer?.id === customer.id}
                            onCheckedChange={() => handleCustomerClick(customer)}
                            className="mx-auto"
                          />
                        </td>
                        <td className="p-4 font-medium text-gray-900 dark:text-gray-50">{customer.member_number}</td>
                        <td className="p-4">
                          <button
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dashboard/members/${customer.id}`)
                            }}
                          >
                            {customer.name}
                          </button>
                        </td>
                        <td className="p-4">
                          {customer.flags && customer.flags.length > 0 ? (
                            <div className="flex gap-1">
                              {customer.flags.map((flag) => (
                                flag.flag_type === "blacklist" ? (
                                  <Badge key={flag.id} variant="destructive" className="text-xs flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    블랙리스트
                                  </Badge>
                                ) : (
                                  <Badge key={flag.id} className="text-xs bg-yellow-600 flex items-center gap-1">
                                    <Flag className="w-3 h-3" />
                                    경고
                                  </Badge>
                                )
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-sm">정상</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{customer.institution || "-"}</td>
                        <td className="p-4 text-gray-700 dark:text-gray-300">{customer.prison_number || "-"}</td>
                        <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-50">
                          {formatNumber(customer.total_point_general || customer.normal_points)}
                        </td>
                        <td className="p-4 text-right font-medium text-gray-900 dark:text-gray-50">
                          {formatNumber(customer.total_point_betting || customer.betting_points)}
                        </td>
                        <td className="p-4 text-center">
                          {/* 미등록 회원인 경우에만 삭제 버튼 표시 */}
                          {(customer.member_number.startsWith('TEMP') || 
                            customer.member_number.startsWith('미등록') || 
                            customer.member_number.startsWith('UNREG') ||
                            customer.name === '미등록' ||
                            customer.name.startsWith('미등록')) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => handleDeleteUnregisteredCustomer(customer.id, customer.member_number, e)}
                              className="h-7 px-2 text-xs"
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              삭제
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 회원 상세 정보 */}
        {selectedCustomer && (
          <>
            {console.log("상세 정보 렌더링:", selectedCustomer.name)}
            {/* 플래그 섹션 */}
            {selectedCustomer.flags && selectedCustomer.flags.length > 0 && (
              <Card className="border-red-300 dark:border-red-800 shadow-sm bg-red-50/50 dark:bg-red-950/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      경고 플래그
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedCustomer.flags.map((flag) => (
                      <div key={flag.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-900">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {flag.flag_type === "blacklist" ? (
                              <Badge variant="destructive" className="text-xs">블랙리스트</Badge>
                            ) : (
                              <Badge className="text-xs bg-yellow-600">경고</Badge>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(flag.created_at)}
                            </span>
                            {flag.user && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                - {flag.user.name || flag.user.username}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 dark:text-gray-50">{flag.reason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFlag(flag.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">회원 정보</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowFlagDialog(true)
                      setFlagType("blacklist")
                      setFlagReason("")
                    }}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    플래그 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">수용기관</Label>
                    <p className="mt-1.5 text-base font-medium text-gray-900 dark:text-gray-50">{selectedCustomer.institution || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">수용번호</Label>
                    <p className="mt-1.5 text-base font-medium text-gray-900 dark:text-gray-50">{selectedCustomer.prison_number || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">문의건수</Label>
                    <p className="mt-1.5 text-base font-medium text-gray-900 dark:text-gray-50">{taskCount}건</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">입금자명</Label>
                    <p className="mt-1.5 text-base font-medium text-gray-900 dark:text-gray-50">{selectedCustomer.depositor_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">총충전액</Label>
                    <p className="mt-1.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(selectedCustomer.total_deposit)}원
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">총사용금액</Label>
                    <p className="mt-1.5 text-base font-semibold text-red-600 dark:text-red-400">
                      {formatNumber(selectedCustomer.total_usage)}원
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">일반 포인트 잔액</Label>
                    <p className="mt-1.5 text-base font-semibold text-blue-600 dark:text-blue-400">
                      {formatNumber(selectedCustomer.total_point_general || selectedCustomer.normal_points)}원
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">배팅 포인트 잔액</Label>
                    <p className="mt-1.5 text-base font-semibold text-purple-600 dark:text-purple-400">
                      {formatNumber(selectedCustomer.total_point_betting || selectedCustomer.betting_points)}원
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 티켓 내역 */}
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">티켓 내역</CardTitle>
                <CardDescription>총 {tasks.length}개의 티켓</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTasks ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
                ) : tasks.length === 0 ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">티켓이 없습니다.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:shadow-md transition-all border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                        onClick={() => handleTaskClick(task)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-50">{task.title}</h3>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(task.status)}`}>
                                  {getStatusLabel(task.status)}
                                </span>
                                {task.comment_count && task.comment_count > 0 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    댓글 {task.comment_count}개
                                  </span>
                                )}
                              </div>
                              {task.summary && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                  {task.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span className={getAmountColor(task.amount, task.point_category)}>
                                  {task.amount
                                    ? `${task.amount > 0 ? "+" : ""}${formatNumber(task.amount)}원 (${
                                        task.point_category || "일반"
                                      })`
                                    : "-"}
                                </span>
                                <span>{formatDate(task.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* 플래그 추가 다이얼로그 */}
        <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>플래그 추가</DialogTitle>
              <DialogDescription>회원에게 경고 또는 블랙리스트 플래그를 추가합니다.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="flag-type">플래그 유형 *</Label>
                <Select value={flagType} onValueChange={(value: "blacklist" | "warning") => setFlagType(value)}>
                  <SelectTrigger id="flag-type" className="border-gray-300 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blacklist">블랙리스트</SelectItem>
                    <SelectItem value="warning">경고</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="flag-reason">플래그 사유 *</Label>
                <Textarea
                  id="flag-reason"
                  placeholder="플래그 사유를 자세히 입력하세요"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="border-gray-300 dark:border-gray-700"
                  rows={4}
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFlagDialog(false)} disabled={addingFlag}>
                취소
              </Button>
              <Button
                onClick={handleAddFlag}
                disabled={addingFlag || !flagReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {addingFlag ? "추가 중..." : "플래그 추가"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 신규회원 추가 다이얼로그 */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">신규회원 추가</DialogTitle>
              <DialogDescription>새로운 회원 정보를 입력합니다.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCustomer}>
              <div className="space-y-5 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">이름 *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="이름"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      required
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">전화번호</Label>
                    <Input
                      id="phone"
                      type="text"
                      placeholder="전화번호"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="institution" className="text-sm font-medium">수용기관 *</Label>
                    <Input
                      id="institution"
                      type="text"
                      placeholder="수용기관"
                      value={newCustomer.institution}
                      onChange={(e) => setNewCustomer({ ...newCustomer, institution: e.target.value })}
                      required
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prison_number" className="text-sm font-medium">수용번호 *</Label>
                    <Input
                      id="prison_number"
                      type="text"
                      placeholder="수용번호"
                      value={newCustomer.prison_number}
                      onChange={(e) => setNewCustomer({ ...newCustomer, prison_number: e.target.value })}
                      required
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositor_name" className="text-sm font-medium">입금자명</Label>
                    <Input
                      id="depositor_name"
                      type="text"
                      placeholder="입금자명"
                      value={newCustomer.depositor_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, depositor_name: e.target.value })}
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mailbox_address" className="text-sm font-medium">사서함 주소</Label>
                    <Input
                      id="mailbox_address"
                      type="text"
                      placeholder="사서함 주소"
                      value={newCustomer.mailbox_address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, mailbox_address: e.target.value })}
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="normal_points" className="text-sm font-medium">일반포인트</Label>
                    <Input
                      id="normal_points"
                      type="number"
                      placeholder="0"
                      value={newCustomer.normal_points}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, normal_points: parseInt(e.target.value) || 0 })
                      }
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="betting_points" className="text-sm font-medium">배팅포인트</Label>
                    <Input
                      id="betting_points"
                      type="number"
                      placeholder="0"
                      value={newCustomer.betting_points}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, betting_points: parseInt(e.target.value) || 0 })
                      }
                      disabled={saving}
                      className="border-gray-300 dark:border-gray-700"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 rounded-md">
                    {success}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} disabled={saving} className="border-gray-300 dark:border-gray-700">
                  취소
                </Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? "저장 중..." : "회원 추가"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* 포인트 지급/차감 다이얼로그 */}
        <Dialog open={showPointDialog} onOpenChange={setShowPointDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>포인트 지급/차감</DialogTitle>
              <DialogDescription>
                {selectedCustomer?.name} ({selectedCustomer?.member_number})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 작업 구분 */}
              <div className="space-y-2">
                <Label>작업 구분</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pointAction === "charge" ? "default" : "outline"}
                    className={pointAction === "charge" ? "flex-1 bg-green-600 hover:bg-green-700" : "flex-1"}
                    onClick={() => setPointAction("charge")}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    지급
                  </Button>
                  <Button
                    type="button"
                    variant={pointAction === "use" ? "default" : "outline"}
                    className={pointAction === "use" ? "flex-1 bg-red-600 hover:bg-red-700" : "flex-1"}
                    onClick={() => setPointAction("use")}
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    차감
                  </Button>
                </div>
              </div>

              {/* 포인트 종류 */}
              <div className="space-y-2">
                <Label>포인트 종류</Label>
                <Select value={pointCategory} onValueChange={(value: any) => setPointCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반 포인트</SelectItem>
                    <SelectItem value="betting">베팅 포인트</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 금액 */}
              <div className="space-y-2">
                <Label>금액</Label>
                <Input
                  type="number"
                  placeholder="금액 입력"
                  value={pointAmount}
                  onChange={(e) => setPointAmount(e.target.value)}
                  min="0"
                  step="1000"
                />
              </div>

              {/* 메모 */}
              <div className="space-y-2">
                <Label>메모 (선택사항)</Label>
                <Textarea
                  placeholder="사유를 입력하세요"
                  value={pointNote}
                  onChange={(e) => setPointNote(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="text-sm text-gray-500 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                ℹ️ 포인트 요청은 재무관리에서 승인 후 적용됩니다.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPointDialog(false)}
                disabled={processingPoint}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handlePointTransaction}
                disabled={processingPoint || !pointAmount}
                className={pointAction === "charge" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              >
                {processingPoint ? "처리 중..." : pointAction === "charge" ? "지급 요청" : "차감 요청"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 티켓 상세 다이얼로그 */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">{selectedTask?.title}</DialogTitle>
              <DialogDescription>티켓 상세 정보 및 댓글</DialogDescription>
            </DialogHeader>

            {selectedTask && (
              <div className="space-y-6 py-4">
                {/* 티켓 정보 */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">상태</Label>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                        {getStatusLabel(selectedTask.status)}
                      </span>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">설명</Label>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-50 bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-md border border-gray-200 dark:border-gray-800">{selectedTask.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">금액</Label>
                      <p className={`mt-1.5 text-sm font-semibold ${getAmountColor(selectedTask.amount, selectedTask.point_category)}`}>
                        {selectedTask.amount
                          ? `${selectedTask.amount > 0 ? "+" : ""}${formatNumber(selectedTask.amount)}원`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">포인트 종류</Label>
                      <p className="mt-1.5 text-sm text-gray-900 dark:text-gray-50">{selectedTask.point_category || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">업무 구분</Label>
                      <p className="mt-1.5 text-sm text-gray-900 dark:text-gray-50">{selectedTask.work_type || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">생성일시</Label>
                      <p className="mt-1.5 text-sm text-gray-900 dark:text-gray-50">{formatDate(selectedTask.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* 댓글 섹션 */}
                <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                  <Label className="text-sm font-medium mb-4 block text-gray-900 dark:text-gray-50">
                    댓글 ({taskComments.length}개)
                  </Label>

                  {/* 댓글 목록 */}
                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    {loadingComments ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</p>
                    ) : taskComments.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">댓글이 없습니다.</p>
                    ) : (
                      taskComments.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-lg border border-gray-200 dark:border-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                              {comment.user?.name || comment.user?.username || "알 수 없음"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{comment.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)} className="border-gray-300 dark:border-gray-700">
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* Inmates Tab Content */}
          <TabsContent value="inmates" className="space-y-6">
            <Card>
              <InmatesContent />
            </Card>
          </TabsContent>

          {/* Blacklist Tab Content */}
          <TabsContent value="blacklist" className="space-y-6">
            <Card>
              <BlacklistContent />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
