"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Task {
  id: string
  customer_id: string | null
  member_id: string | null
  ticket_no: string | null
  title: string
  description: string | null
  status: string
  work_type: string | null
  point_category: string | null
  amount: number | null
  total_amount: number | null
  ai_summary: string | null
  created_at: string
  user_id: string
  customers: {
    member_number: string
    name: string
  } | null
  user: {
    name: string | null
    username: string
  } | null
}

interface TaskItem {
  id: string
  task_id: string
  category: string
  description: string
  amount: number
  status: string
  created_at: string
}

interface Employee {
  id: string
  name: string | null
  username: string
  role: string
}

export default function ApprovalsClient() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskItems, setTaskItems] = useState<TaskItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // 편집용 상태
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")

  const supabase = createClient()

  useEffect(() => {
    loadTasks()
    loadEmployees()
    getCurrentUser()
  }, [])

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
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

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          customers (
            member_number,
            name
          ),
          user:users!tasks_user_id_fkey (name, username)
        `
        )
        .eq("status", "draft")
        .order("created_at", { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error: any) {
      console.error("Error loading tasks:", error)
      setError("업무 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task)
    setSelectedEmployeeId("")
    setTaskItems([])
    setIsDialogOpen(true)
    await loadTaskItems(task.id)
  }

  const loadTaskItems = async (taskId: string) => {
    setLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from("task_items")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })

      if (error) throw error
      setTaskItems(data || [])
    } catch (error: any) {
      console.error("Error loading task items:", error)
      setError("아이템 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoadingItems(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedTask || !currentUserId) return

    if (!selectedEmployeeId) {
      setError("직원을 선택해주세요.")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // 모든 task_items 상태를 'approved'로 변경
      if (taskItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("task_items")
          .update({ status: "approved" })
          .eq("task_id", selectedTask.id)

        if (itemsError) throw itemsError
      }

      // task 상태 업데이트
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          status: "assigned",
          assigned_to: selectedEmployeeId,
          approved_by: currentUserId,
        })
        .eq("id", selectedTask.id)

      if (taskError) throw taskError

      setSuccess("승인 및 배당이 완료되었습니다.")
      setIsDialogOpen(false)
      loadTasks()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "승인에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedTask || !currentUserId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // 모든 task_items 상태를 'rejected'로 변경
      if (taskItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("task_items")
          .update({ status: "rejected" })
          .eq("task_id", selectedTask.id)

        if (itemsError) throw itemsError
      }

      // task 상태 업데이트
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          status: "rejected",
          approved_by: currentUserId,
        })
        .eq("id", selectedTask.id)

      if (taskError) throw taskError

      setSuccess("반려가 완료되었습니다.")
      setIsDialogOpen(false)
      loadTasks()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "반려에 실패했습니다.")
    } finally {
      setSaving(false)
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

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            ← 뒤로가기
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            홈
          </Button>
          <h1 className="text-3xl font-bold">검수</h1>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>승인 대기 티켓</CardTitle>
            <CardDescription>승인 대기 중인 티켓 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center p-8">로딩 중...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center p-8 text-gray-500">승인 대기 중인 티켓이 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회원</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>업무 구분</TableHead>
                    <TableHead>포인트 구분</TableHead>
                    <TableHead>금액</TableHead>
                    <TableHead>접수 담당자</TableHead>
                    <TableHead>접수일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => handleTaskClick(task)}
                    >
                      <TableCell>
                        {task.customers
                          ? `${task.customers.member_number} - ${task.customers.name}`
                          : "-"}
                      </TableCell>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{task.work_type || "-"}</TableCell>
                      <TableCell>{task.point_category || "-"}</TableCell>
                      <TableCell>
                        {task.amount ? task.amount.toLocaleString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>{task.user?.name || task.user?.username || "-"}</TableCell>
                      <TableCell>{formatDate(task.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 상세 모달 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>티켓 상세 정보</DialogTitle>
              <DialogDescription>티켓 정보를 확인하고 직원에게 배당하세요.</DialogDescription>
            </DialogHeader>

            {selectedTask && (
              <div className="space-y-6 py-4">
                {/* 상단: 티켓번호, 회원명, AI 요약문, 총액 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">티켓번호</Label>
                    <p className="text-base font-mono text-gray-900 dark:text-gray-50">
                      {selectedTask.ticket_no || selectedTask.id.substring(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">회원명</Label>
                    <p className="text-base text-gray-900 dark:text-gray-50">
                      {selectedTask.customers
                        ? `${selectedTask.customers.member_number} - ${selectedTask.customers.name}`
                        : "-"}
                    </p>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">AI 요약</Label>
                    <p className="text-base text-gray-900 dark:text-gray-50 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                      {selectedTask.ai_summary || selectedTask.description || "-"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">총액</Label>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-50">
                      {formatNumber(selectedTask.total_amount || 0)}P
                    </p>
                  </div>
                </div>

                {/* 중단: 아이템 리스트 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">아이템 목록</Label>
                  {loadingItems ? (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
                  ) : taskItems.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-md">
                      아이템이 없습니다.
                    </div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">구분</TableHead>
                            <TableHead>내용</TableHead>
                            <TableHead className="w-[120px] text-right">금액</TableHead>
                            <TableHead className="w-[100px]">상태</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taskItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {getCategoryLabel(item.category)}
                              </TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatNumber(item.amount)}P
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                    item.status === "approved"
                                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                                      : item.status === "rejected"
                                      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                      : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  }`}
                                >
                                  {item.status === "approved"
                                    ? "승인"
                                    : item.status === "rejected"
                                    ? "반려"
                                    : "대기"}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* 하단: 직원 배당 및 승인/반려 버튼 */}
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="space-y-2">
                    <Label htmlFor="employee-select" className="text-sm font-medium">
                      담당 직원 배당 *
                    </Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger id="employee-select" className="border-gray-300 dark:border-gray-700">
                        <SelectValue placeholder="직원을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name || employee.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={handleReject}
                      disabled={saving}
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      반려
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={saving || !selectedEmployeeId}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saving ? "처리 중..." : "승인"}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
