"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface User {
  id: string
  username: string
  email: string
  name: string | null
  role: string
  created_at: string
}

export default function EmployeesClient() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    name: "",
    role: "operator" as "admin" | "operator" | "employee",
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error: any) {
      console.error("Error loading users:", error)
      setError("사용자 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "계정 생성에 실패했습니다.")
      }

      setSuccess(result.message || "계정이 성공적으로 생성되었습니다.")
      setNewUser({ username: "", password: "", name: "", role: "operator" })
      setShowCreateForm(false)
      loadUsers() // 목록 새로고침
    } catch (error: any) {
      setError(error.message || "계정 생성에 실패했습니다.")
    } finally {
      setCreating(false)
    }
  }

  const generatePassword = () => {
    const length = 12
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    setNewUser({ ...newUser, password })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              ← 뒤로가기
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              홈
            </Button>
            <h1 className="text-3xl font-bold">직원 관리</h1>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "취소" : "+ 새 계정 생성"}
          </Button>
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>새 계정 생성</CardTitle>
              <CardDescription>새로운 사용자 계정을 생성합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">아이디 *</label>
                    <Input
                      type="text"
                      placeholder="아이디 입력 (이메일 형식도 가능)"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                      disabled={creating}
                    />
                    <p className="text-xs text-gray-500">이메일 형식으로 입력 시 @ 앞부분만 아이디로 사용됩니다</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">이름</label>
                    <Input
                      type="text"
                      placeholder="홍길동"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      disabled={creating}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">비밀번호 *</label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="비밀번호 입력"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                        disabled={creating}
                      />
                      <Button type="button" variant="outline" onClick={generatePassword} disabled={creating}>
                        생성
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">권한</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "operator" | "employee" })}
                      disabled={creating}
                    >
                      <option value="admin">관리자</option>
                      <option value="operator">오퍼레이터</option>
                      <option value="employee">직원</option>
                    </select>
                  </div>
                </div>
                {error && (
                  <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">{error}</div>
                )}
                {success && (
                  <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                    {success}
                  </div>
                )}
                <Button type="submit" disabled={creating}>
                  {creating ? "생성 중..." : "계정 생성"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>사용자 목록</CardTitle>
            <CardDescription>전체 사용자 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">아이디</th>
                    <th className="text-left p-4">이름</th>
                    <th className="text-left p-4">권한</th>
                    <th className="text-left p-4">가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-8 text-gray-500">
                        사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-4">{user.username}</td>
                        <td className="p-4">{user.name || "-"}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              user.role === "admin"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {user.role === "admin" ? "관리자" : user.role === "operator" ? "오퍼레이터" : "직원"}
                          </span>
                        </td>
                        <td className="p-4">{new Date(user.created_at).toLocaleDateString("ko-KR")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
