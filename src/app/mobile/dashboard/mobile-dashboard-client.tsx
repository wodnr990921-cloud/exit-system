"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Package,
  DollarSign,
  ClipboardCheck,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
} from "lucide-react"

interface User {
  id: string
  username: string
  name: string | null
  email: string
  role: string
}

interface Stats {
  pendingTasks: number
  todayTasks: number
  totalCustomers: number
  todayRevenue: number
}

export default function MobileDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats>({
    pendingTasks: 0,
    todayTasks: 0,
    totalCustomers: 0,
    todayRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadUserAndStats()
  }, [])

  const loadUserAndStats = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/")
        return
      }

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()

      setUser(userData)

      // Load stats
      const today = new Date().toISOString().split("T")[0]

      const [
        { count: pendingCount },
        { count: todayCount },
        { count: customerCount },
      ] = await Promise.all([
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .gte("created_at", `${today}T00:00:00Z`),
        supabase.from("customers").select("*", { count: "exact", head: true }),
      ])

      setStats({
        pendingTasks: pendingCount || 0,
        todayTasks: todayCount || 0,
        totalCustomers: customerCount || 0,
        todayRevenue: 0,
      })
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { label: string; className: string }> = {
      admin: { label: "관리자", className: "bg-red-100 text-red-800" },
      ceo: { label: "대표", className: "bg-purple-100 text-purple-800" },
      operator: { label: "운영자", className: "bg-blue-100 text-blue-800" },
      staff: { label: "직원", className: "bg-green-100 text-green-800" },
    }
    return styles[role] || { label: role, className: "bg-gray-100 text-gray-800" }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  const roleBadge = user ? getRoleBadge(user.role) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Exit System</h1>
            {roleBadge && (
              <Badge className={roleBadge.className}>{roleBadge.label}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="border-t border-gray-200 bg-white">
            <nav className="p-4 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/mobile/tasks")
                  setMenuOpen(false)
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                업무 목록
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/mobile/members")
                  setMenuOpen(false)
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                회원 관리
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/mobile/operations")
                  setMenuOpen(false)
                }}
              >
                <Package className="h-4 w-4 mr-2" />
                업무 관리
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/mobile/work-report")
                  setMenuOpen(false)
                }}
              >
                <Clock className="h-4 w-4 mr-2" />
                업무 보고
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  router.push("/mobile/settings")
                  setMenuOpen(false)
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                설정
              </Button>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-4 pb-20">
        {/* Welcome Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>안녕하세요, {user?.name || user?.username}님</CardTitle>
            <CardDescription>오늘도 좋은 하루 되세요!</CardDescription>
          </CardHeader>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">대기 중</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.pendingTasks}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">오늘 업무</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.todayTasks}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">총 회원</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalCustomers}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">오늘 매출</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.todayRevenue.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">빠른 작업</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/mobile/tasks/new")}
            >
              <FileText className="h-4 w-4 mr-2" />
              새 업무 등록
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/mobile/members/search")}
            >
              <Users className="h-4 w-4 mr-2" />
              회원 조회
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/mobile/operations")}
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              업무 관리
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/mobile/work-report")}
            >
              <Clock className="h-4 w-4 mr-2" />
              출퇴근 기록
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="grid grid-cols-4 gap-1 p-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => router.push("/mobile")}
          >
            <Package className="h-5 w-5" />
            <span className="text-xs">홈</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => router.push("/mobile/tasks")}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">업무</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => router.push("/mobile/members")}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs">회원</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => router.push("/mobile/settings")}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs">설정</span>
          </Button>
        </div>
      </nav>
    </div>
  )
}
