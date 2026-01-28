"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Mail,
  Target,
  AlertCircle,
  CheckCircle2,
  Users,
  Package,
  Building2,
  Camera,
  Printer,
  ClipboardList,
} from "lucide-react"
import NoticePopup from "@/components/notice-popup"
import WorkReportWidget from "./work-report-widget"
import UnprocessedTicketsAlert from "@/components/unprocessed-tickets-alert"
import MonthlyPanel from "./panels/monthly-panel"
import DailyPanel from "./panels/daily-panel"
import StaffTaskPanel from "./panels/staff-task-panel"
import AdminApprovalPanel from "./panels/admin-approval-panel"

interface User {
  id: string
  name: string | null
  username: string
  role: string
}

interface DashboardStats {
  todayRevenue: number
  pendingApprovals: number
  todayIntake: number
  processingRate: number
  myTasks: number
  myProcessed: number
  pointLiability: number
  lowStockCount: number
  pendingDocumentCount: number
}

interface PendingApproval {
  id: string
  type: "finance" | "task"
  customer_name?: string
  amount?: number
  status: string
  created_at: string
}

export default function DashboardClient() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [previewMode, setPreviewMode] = useState<{
    isActive: boolean
    employeeId?: string
    employeeName?: string
    employeeRole?: string
  } | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    pendingApprovals: 0,
    todayIntake: 0,
    processingRate: 0,
    myTasks: 0,
    myProcessed: 0,
    pointLiability: 0,
    lowStockCount: 0,
    pendingDocumentCount: 0,
  })
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [myTasks, setMyTasks] = useState<any[]>([])

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      loadDashboardStats()
      if (currentUser.role === "ceo" || currentUser.role === "admin" || currentUser.role === "operator") {
        loadPendingApprovals()
      } else if (currentUser.role === "staff" || currentUser.role === "employee") {
        loadMyTasks()
      }
    }
  }, [currentUser])

  const loadCurrentUser = async () => {
    try {
      // 미리보기 모드 확인
      const previewData = localStorage.getItem("preview_mode")
      if (previewData) {
        const preview = JSON.parse(previewData)
        if (preview.isActive) {
          setPreviewMode(preview)
          // 미리보기 대상 직원 정보 로드
          const { data } = await supabase
            .from("users")
            .select("id, name, username, role")
            .eq("id", preview.employeeId)
            .single()
          
          if (data) {
            setCurrentUser(data)
          }
          setLoading(false)
          return
        }
      }

      // 일반 모드: 현재 로그인한 사용자 정보
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("users")
        .select("id, name, username, role")
        .eq("id", user.id)
        .single()

      if (data) {
        setCurrentUser(data)
      }
    } catch (error) {
      console.error("Error loading user:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleExitPreview = async () => {
    try {
      // 미리보기 종료 API 호출
      await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stop",
        }),
      })

      // 미리보기 모드 해제
      localStorage.removeItem("preview_mode")
      
      // 설정 페이지로 이동
      window.location.href = "/dashboard/settings?tab=employees"
    } catch (error) {
      console.error("Error exiting preview:", error)
      // 에러가 발생해도 미리보기 모드는 해제
      localStorage.removeItem("preview_mode")
      window.location.href = "/dashboard/settings?tab=employees"
    }
  }

  const loadDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]

      // Today revenue (points charged)
      const { data: revenueData } = await supabase
        .from("points")
        .select("amount")
        .eq("type", "charge")
        .eq("status", "approved")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      const todayRevenue = revenueData?.reduce((sum, item) => sum + item.amount, 0) || 0

      // Pending approvals count
      const { count: pendingCount } = await supabase
        .from("points")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")

      // Today intake (letters)
      const { count: intakeCount } = await supabase
        .from("letters")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      // Processing rate
      const { count: totalTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      const { count: processedTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("status", ["completed", "closed"])
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      const processingRate = totalTasks ? Math.round(((processedTasks || 0) / totalTasks) * 100) : 0

      // Point Liability - for admin only
      let pointLiability = 0
      let lowStockCount = 0
      let pendingDocumentCount = 0

      if (currentUser && (currentUser.role === "ceo" || currentUser.role === "admin" || currentUser.role === "operator")) {
        // Get point liability from API
        try {
          const liabilityResponse = await fetch("/api/finance/point-liability")
          const liabilityData = await liabilityResponse.json()
          if (liabilityData.success) {
            pointLiability = liabilityData.liability?.total || 0
          }
        } catch (error) {
          console.error("Error fetching point liability:", error)
        }

        // Get low stock alerts from API
        try {
          const inventoryResponse = await fetch("/api/inventory/alerts")
          const inventoryData = await inventoryResponse.json()
          if (inventoryData.success) {
            lowStockCount = inventoryData.alerts?.length || 0
          }
        } catch (error) {
          console.error("Error fetching inventory alerts:", error)
        }

        // Get pending document retention count from API
        try {
          const documentResponse = await fetch("/api/document-retention?status=pending")
          const documentData = await documentResponse.json()
          if (documentData.success) {
            pendingDocumentCount = documentData.documents?.length || 0
          }
        } catch (error) {
          console.error("Error fetching document retention:", error)
        }
      }

      // My tasks (for staff)
      if (currentUser && (currentUser.role === "staff" || currentUser.role === "employee")) {
        const { count: myTasksCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", currentUser.id)
          .not("status", "in", '("completed","closed")')

        const { count: myProcessedCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", currentUser.id)
          .in("status", ["completed", "closed"])
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`)

        setStats({
          todayRevenue,
          pendingApprovals: pendingCount || 0,
          todayIntake: intakeCount || 0,
          processingRate,
          myTasks: myTasksCount || 0,
          myProcessed: myProcessedCount || 0,
          pointLiability: 0,
          lowStockCount: 0,
          pendingDocumentCount: 0,
        })
      } else {
        setStats({
          todayRevenue,
          pendingApprovals: pendingCount || 0,
          todayIntake: intakeCount || 0,
          processingRate,
          myTasks: 0,
          myProcessed: 0,
          pointLiability,
          lowStockCount,
          pendingDocumentCount,
        })
      }
    } catch (error) {
      console.error("Error loading dashboard stats:", error)
    }
  }

  const loadMyTasks = async () => {
    if (!currentUser) return

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          ticket_no,
          title,
          status,
          created_at,
          customer:customers(name, member_number)
        `)
        .eq("assigned_to", currentUser.id)
        .not("status", "in", '("completed","closed")')
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) throw error

      setMyTasks(data || [])
    } catch (error) {
      console.error("Error loading my tasks:", error)
      setMyTasks([])
    }
  }

  const loadPendingApprovals = async () => {
    try {
      // Load pending point approvals
      const { data: pointApprovals } = await supabase
        .from("points")
        .select(
          `
          id,
          amount,
          status,
          created_at,
          customers (name)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10)

      const approvals: PendingApproval[] =
        pointApprovals?.map((item: any) => ({
          id: item.id,
          type: "finance" as const,
          customer_name: item.customers?.name,
          amount: item.amount,
          status: item.status,
          created_at: item.created_at,
        })) || []

      setPendingApprovals(approvals)
    } catch (error) {
      console.error("Error loading pending approvals:", error)
    }
  }

  const handleApprove = async (approvalId: string) => {
    try {
      const response = await fetch("/api/points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: approvalId }),
      })

      if (response.ok) {
        loadDashboardStats()
        loadPendingApprovals()
      }
    } catch (error) {
      console.error("Error approving:", error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  // 최종 메뉴 구조 (2026-01-14):
  // 1. 재무관리 + 일일마감 + 월말정산 + 휴면포인트 + 소모품재고 = 업무관리 (탭)
  // 2. 수용자관리 + 블랙리스트 + 회원관리 = 회원관리 (통합)
  // 3. 내작업목록 + 원본파기 + 반송처리 = 문의/답변 (통합)
  // 4. 댓글(내부) vs 답글(회원) 구분
  // 5. 업무보고 (출퇴근, 소모품, 경비, 전달사항) - 맨 하단 배치
  const allMenuItems = [
    { id: "mailroom", label: "📸 우편실", path: "/dashboard/mailroom", requiredRole: ["operator", "ceo", "admin"], color: "blue" },
    { id: "qa", label: "💬 문의/답변", path: "/dashboard/qa", requiredRole: null, color: "blue" },
    { id: "closing", label: "📊 일일마감", path: "/dashboard/closing", requiredRole: ["operator", "ceo", "admin"], color: "red" },
    { id: "procurement", label: "📦 발주관리", path: "/dashboard/procurement", requiredRole: ["operator", "ceo", "admin"], color: "blue" },
    { id: "logistics", label: "🚚 배송관리", path: "/dashboard/logistics", requiredRole: null, color: "blue" },
    { id: "betting", label: "🎯 배팅업무", path: "/dashboard/sports", requiredRole: ["operator", "ceo", "admin"], color: "green" },
    { id: "operations", label: "💼 업무관리", path: "/dashboard/operations", requiredRole: ["operator", "ceo", "admin"], color: "emerald" },
    { id: "members", label: "👥 회원관리", path: "/dashboard/members", requiredRole: null, color: "purple" },
    { id: "notices", label: "📢 공지사항", path: "/dashboard/notices", requiredRole: ["operator", "ceo", "admin"], color: "blue" },
    { id: "audit-logs", label: "🛡️ 감사로그", path: "/dashboard/audit-logs", requiredRole: ["ceo", "admin"], color: "red" },
    { id: "settings", label: "⚙️ 설정", path: "/dashboard/settings", requiredRole: ["operator", "ceo", "admin"], color: "purple" },
    { id: "work-report", label: "📋 업무보고", path: "/dashboard/work-report", requiredRole: null, color: "blue" },
  ]

  const menuItems = allMenuItems.filter((item) => {
    if (!item.requiredRole) return true
    if (!currentUser) return false
    return item.requiredRole.includes(currentUser.role)
  })

  const activeMenuItem = menuItems.find((item) => pathname === item.path)?.id || menuItems[0]?.id || "mailroom"

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("ko-KR") + "원"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: "hover:bg-blue-50 dark:hover:bg-blue-900/30 data-[active=true]:bg-blue-100 dark:data-[active=true]:bg-blue-900/40 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300 data-[active=true]:border-l-4 data-[active=true]:border-blue-600 dark:data-[active=true]:border-blue-400 data-[active=true]:font-semibold",
      green: "hover:bg-green-50 dark:hover:bg-green-900/30 data-[active=true]:bg-green-100 dark:data-[active=true]:bg-green-900/40 data-[active=true]:text-green-700 dark:data-[active=true]:text-green-300 data-[active=true]:border-l-4 data-[active=true]:border-green-600 dark:data-[active=true]:border-green-400 data-[active=true]:font-semibold",
      purple: "hover:bg-purple-50 dark:hover:bg-purple-900/30 data-[active=true]:bg-purple-100 dark:data-[active=true]:bg-purple-900/40 data-[active=true]:text-purple-700 dark:data-[active=true]:text-purple-300 data-[active=true]:border-l-4 data-[active=true]:border-purple-600 dark:data-[active=true]:border-purple-400 data-[active=true]:font-semibold",
      emerald: "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 data-[active=true]:bg-emerald-100 dark:data-[active=true]:bg-emerald-900/40 data-[active=true]:text-emerald-700 dark:data-[active=true]:text-emerald-300 data-[active=true]:border-l-4 data-[active=true]:border-emerald-600 dark:data-[active=true]:border-emerald-400 data-[active=true]:font-semibold",
      red: "hover:bg-red-50 dark:hover:bg-red-900/30 data-[active=true]:bg-red-100 dark:data-[active=true]:bg-red-900/40 data-[active=true]:text-red-700 dark:data-[active=true]:text-red-300 data-[active=true]:border-l-4 data-[active=true]:border-red-600 dark:data-[active=true]:border-red-400 data-[active=true]:font-semibold",
      gray: "hover:bg-gray-100 dark:hover:bg-gray-800 data-[active=true]:bg-gray-200 dark:data-[active=true]:bg-gray-700 data-[active=true]:text-gray-900 dark:data-[active=true]:text-gray-50 data-[active=true]:border-l-4 data-[active=true]:border-gray-600 dark:data-[active=true]:border-gray-400 data-[active=true]:font-semibold",
    }
    return colorMap[color] || colorMap.gray
  }

  const getMenuItemBadge = (item: typeof allMenuItems[0]) => {
    if (!currentUser) return null
    const isAdminUser = ["admin", "operator", "ceo"].includes(currentUser.role)
    const isAdminOnly = item.requiredRole && item.requiredRole.length > 0

    if (isAdminUser && isAdminOnly) {
      return (
        <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0.5 bg-purple-600 dark:bg-purple-700 text-white border-0">
          관리자
        </Badge>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    )
  }

  // Staff View
  if (currentUser && (currentUser.role === "staff" || currentUser.role === "employee")) {
    return (
      <>
        <NoticePopup />
        {/* 미리보기 모드 배너 */}
        {previewMode && previewMode.isActive && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-6 flex items-center justify-between shadow-lg sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">
                🔍 미리보기 모드: {previewMode.employeeName || "직원"}님의 화면을 보고 있습니다.
              </span>
            </div>
            <Button
              onClick={handleExitPreview}
              size="sm"
              variant="secondary"
              className="bg-white text-orange-600 hover:bg-gray-100"
            >
              미리보기 종료
            </Button>
          </div>
        )}
        <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
        {/* Sidebar */}
        <aside className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="p-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-1">업무 시스템</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">직원 대시보드</p>
            </div>
            <nav className="space-y-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  data-active={activeMenuItem === item.id}
                  className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-lg transition-all text-gray-700 dark:text-gray-300 ${getColorClasses(item.color)}`}
                >
                  <span>{item.label}</span>
                  {getMenuItemBadge(item)}
                </button>
              ))}
            </nav>
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                  {currentUser.name || currentUser.username}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">직원</p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                로그아웃
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Welcome */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                안녕하세요, {currentUser.name || currentUser.username}님
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">오늘도 화이팅!</p>
            </div>

            {/* Work Report Widget */}
            <WorkReportWidget />

            {/* Unprocessed Tickets Alert */}
            {currentUser && (
              <UnprocessedTicketsAlert userRole={currentUser.role} userId={currentUser.id} />
            )}

            {/* Staff Task Panel - Centered and expanded for staff users */}
            <div className="max-w-6xl mx-auto">
              <StaffTaskPanel userId={currentUser?.id} role={currentUser?.role} />
            </div>

            {/* KPI Cards - Staff */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>나의 할 일</CardDescription>
                  <CardTitle className="text-3xl">{stats.myTasks}건</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Target className="w-4 h-4" />
                    <span>배당된 티켓</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>오늘 처리</CardDescription>
                  <CardTitle className="text-3xl">{stats.myProcessed}건</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>완료</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>진행률</CardDescription>
                  <CardTitle className="text-3xl">
                    {stats.myTasks > 0
                      ? Math.round((stats.myProcessed / stats.myTasks) * 100)
                      : 0}
                    %
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>목표 달성률</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-50">빠른 작업</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-28 flex-col gap-3 hover:shadow-md hover:border-primary/50"
                  onClick={() => router.push("/dashboard/mailroom")}
                >
                  <Camera className="w-7 h-7" />
                  <span className="text-sm font-medium">우편물 업로드</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-28 flex-col gap-3 hover:shadow-md hover:border-primary/50"
                  onClick={() => router.push("/dashboard/intake")}
                >
                  <ClipboardList className="w-7 h-7" />
                  <span className="text-sm font-medium">내 작업 목록</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-28 flex-col gap-3 hover:shadow-md hover:border-primary/50"
                  onClick={() => router.push("/dashboard/logistics")}
                >
                  <Package className="w-7 h-7" />
                  <span className="text-sm font-medium">발주 확인</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-28 flex-col gap-3 hover:shadow-md hover:border-primary/50"
                  onClick={() => router.push("/dashboard/closing/print")}
                >
                  <Printer className="w-7 h-7" />
                  <span className="text-sm font-medium">송장 출력</span>
                </Button>
              </div>
            </div>

            {/* 배당된 티켓 목록 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>📋 배당된 티켓 (마감 전)</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/intake")}
                    className="text-xs"
                  >
                    전체 보기 →
                  </Button>
                </CardTitle>
                <CardDescription>내게 배당된 진행 중인 티켓입니다</CardDescription>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>배당된 티켓이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => router.push("/dashboard/intake")}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              {task.ticket_no || task.id.slice(0, 8)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              task.status === "pending"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : task.status === "assigned"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : task.status === "in_progress"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {task.status === "pending"
                                ? "대기"
                                : task.status === "assigned"
                                ? "배정됨"
                                : task.status === "in_progress"
                                ? "진행중"
                                : task.status}
                            </span>
                          </div>
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
                            {task.title}
                          </p>
                          {task.customer && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {task.customer.member_number} - {task.customer.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(task.created_at).toLocaleDateString("ko-KR", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      </>
    )
  }

  // Admin View
  return (
    <>
      <NoticePopup />
      {/* 미리보기 모드 배너 */}
      {previewMode && previewMode.isActive && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-6 flex items-center justify-between shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">
              🔍 미리보기 모드: {previewMode.employeeName || "직원"}님의 화면을 보고 있습니다.
            </span>
          </div>
          <Button
            onClick={handleExitPreview}
            size="sm"
            variant="secondary"
            className="bg-white text-orange-600 hover:bg-gray-100"
          >
            미리보기 종료
          </Button>
        </div>
      )}
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-1">관리 시스템</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">관리자 대시보드</p>
          </div>
          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                data-active={activeMenuItem === item.id}
                className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-lg transition-all text-gray-700 dark:text-gray-300 ${getColorClasses(item.color)}`}
              >
                <span>{item.label}</span>
                {getMenuItemBadge(item)}
              </button>
            ))}
          </nav>
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
            <div className="mb-4 p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                {currentUser?.name || currentUser?.username}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                {currentUser?.role === "ceo" ? "CEO" : currentUser?.role === "admin" ? "관리자" : "운영자"}
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              관리자 대시보드
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              실시간 업무 현황 및 승인 관리
            </p>
          </div>

          {/* Work Report Widget */}
          <WorkReportWidget />

          {/* Unprocessed Tickets Alert */}
          {currentUser && (
            <UnprocessedTicketsAlert userRole={currentUser.role} userId={currentUser.id} />
          )}

          {/* 4-Panel Dashboard Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel 1: Monthly Summary - Admin only */}
            <MonthlyPanel />

            {/* Panel 2: Daily Report - Admin only */}
            <DailyPanel />

            {/* Panel 3: Staff Task Panel - All users */}
            <StaffTaskPanel userId={currentUser?.id} role={currentUser?.role} />

            {/* Panel 4: Admin Approval Panel - Admin only */}
            <AdminApprovalPanel />
          </div>

          {/* KPI Cards - Admin */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>포인트 부채</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {formatCurrency(stats.pointLiability)}
                  {stats.pointLiability > 1000000 && (
                    <Badge variant="destructive" className="text-xs">
                      주의
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <DollarSign className="w-4 h-4" />
                  <span>미사용 잔액</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>입금 승인 대기</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {stats.pendingApprovals}건
                  {stats.pendingApprovals > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      긴급
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>확인 필요</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>소모품 재고 부족</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {stats.lowStockCount}건
                  {stats.lowStockCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      긴급
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <Package className="w-4 h-4" />
                  <span>발주 필요</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>파기 예정 문서</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {stats.pendingDocumentCount}건
                  {stats.pendingDocumentCount > 0 && (
                    <Badge className="text-xs bg-purple-600">
                      대기
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-purple-600">
                  <FileText className="w-4 h-4" />
                  <span>처리 필요</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Approvals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Finance Approvals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  자금 승인
                </CardTitle>
                <CardDescription>입금 확인 및 승인이 필요한 건</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    승인 대기 중인 입금이 없습니다
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>회원</TableHead>
                        <TableHead className="text-right">금액</TableHead>
                        <TableHead className="text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.slice(0, 5).map((approval) => (
                        <TableRow key={approval.id}>
                          <TableCell className="font-medium">
                            {approval.customer_name || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(approval.amount || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleApprove(approval.id)}>
                              승인
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Operation Approvals - night_work.md 요구사항 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  업무 승인
                </CardTitle>
                <CardDescription>직원이 처리 완료한 티켓 검토</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    승인 대기 중인 업무가 없습니다
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/intake")}
                  >
                    전체 티켓 보기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions - night_work.md: 빠른 작업 버튼 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                빠른 작업
              </CardTitle>
              <CardDescription>자주 사용하는 기능 바로가기</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-3 hover:shadow-md hover:border-blue-500/50"
                  onClick={() => router.push("/dashboard/mailroom")}
                >
                  <Mail className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-medium">우편실</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-3 hover:shadow-md hover:border-emerald-500/50"
                  onClick={() => router.push("/dashboard/finance")}
                >
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  <span className="text-sm font-medium">재무관리</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-3 hover:shadow-md hover:border-red-500/50"
                  onClick={() => router.push("/dashboard/closing")}
                >
                  <FileText className="w-6 h-6 text-red-600" />
                  <span className="text-sm font-medium">일일 마감</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-24 flex-col gap-3 hover:shadow-md hover:border-purple-500/50"
                  onClick={() => router.push("/dashboard/members")}
                >
                  <Users className="w-6 h-6 text-purple-600" />
                  <span className="text-sm font-medium">회원 관리</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
    </>
  )
}
