"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, User, Lock, Bell, Info, LogOut, Monitor } from "lucide-react"

interface User {
  id: string
  username: string
  name: string | null
  email: string
  role: string
}

export default function MobileSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push("/")
        return
      }

      const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single()

      setUser(data)
    } catch (error) {
      console.error("Error loading user:", error)
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">설정</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-20">
        {/* User Info Card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{user?.name || user?.username}</p>
                <p className="text-sm text-gray-600">{user?.email}</p>
                {roleBadge && (
                  <Badge className={`mt-1 ${roleBadge.className}`}>{roleBadge.label}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Menu */}
        <div className="space-y-3">
          <Card className="cursor-pointer active:bg-gray-50" onClick={() => router.push("/dashboard")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 text-gray-600" />
                <span className="flex-1 font-medium">PC 화면으로 전환</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer active:bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-gray-600" />
                <span className="flex-1 font-medium">비밀번호 변경</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer active:bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="flex-1 font-medium">알림 설정</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer active:bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-gray-600" />
                <span className="flex-1 font-medium">앱 정보</span>
                <span className="text-sm text-gray-400">v1.0.0</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer active:bg-gray-50" onClick={handleLogout}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5 text-red-600" />
                <span className="flex-1 font-medium text-red-600">로그아웃</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
