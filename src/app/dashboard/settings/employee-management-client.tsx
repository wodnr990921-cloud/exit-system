"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Users, UserPlus, Edit, CheckCircle, X, AlertCircle, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Employee {
  id: string
  username: string
  email: string
  name: string | null
  role: string
  is_approved: boolean
  created_at: string
  last_login: string | null
}

export default function EmployeeManagementClient() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    role: "staff",
  })
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    is_approved: false,
  })
  const [updating, setUpdating] = useState(false)

  // Preview mode
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })

      if (fetchError) throw fetchError

      setEmployees(data || [])
    } catch (err: any) {
      setError(err.message || "직원 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEmployee = async () => {
    if (!newEmployee.username || !newEmployee.email || !newEmployee.password) {
      setError("필수 항목을 모두 입력해주세요.")
      return
    }

    try {
      setCreating(true)
      setError(null)

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newEmployee.username,
          email: newEmployee.email,
          name: newEmployee.name || newEmployee.username,
          password: newEmployee.password,
          role: newEmployee.role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "직원 생성에 실패했습니다.")
      }

      setSuccess("직원이 생성되었습니다.")
      setIsCreateDialogOpen(false)
      setNewEmployee({
        username: "",
        email: "",
        name: "",
        password: "",
        role: "staff",
      })
      loadEmployees()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setSelectedEmployee(employee)
    setEditForm({
      name: employee.name || "",
      role: employee.role,
      is_approved: employee.is_approved,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return

    try {
      setUpdating(true)
      setError(null)

      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: editForm.name,
          role: editForm.role,
          is_approved: editForm.is_approved,
        })
        .eq("id", selectedEmployee.id)

      if (updateError) throw updateError

      setSuccess("직원 정보가 업데이트되었습니다.")
      setIsEditDialogOpen(false)
      loadEmployees()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleApprove = async (employeeId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_approved: true })
        .eq("id", employeeId)

      if (updateError) throw updateError

      setSuccess("직원이 승인되었습니다.")
      loadEmployees()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handlePreview = async (employeeId: string, employeeName: string) => {
    if (previewing) {
      setError("이미 미리보기 모드입니다.")
      return
    }

    try {
      setPreviewing(true)

      const response = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          action: "start",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "미리보기 시작에 실패했습니다.")
      }

      // 미리보기 정보를 localStorage에 저장
      localStorage.setItem("preview_mode", JSON.stringify({
        isActive: true,
        employeeId: data.preview.employeeId,
        employeeName: data.preview.employeeName,
        employeeRole: data.preview.employeeRole,
        adminId: employeeId, // 현재 관리자의 ID (나중에 되돌리기 위해)
      }))

      // 성공 메시지 표시
      setSuccess(`${employeeName}님의 화면 미리보기를 시작합니다. 잠시 후 화면이 전환됩니다...`)

      // 대시보드로 리다이렉트 (미리보기 모드로)
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 1000)
    } catch (err: any) {
      setError(err.message)
      setPreviewing(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { label: string; className: string }> = {
      admin: { label: "관리자", className: "bg-red-100 text-red-800 border-red-200" },
      ceo: { label: "대표", className: "bg-purple-100 text-purple-800 border-purple-200" },
      operator: { label: "운영자", className: "bg-blue-100 text-blue-800 border-blue-200" },
      staff: { label: "직원", className: "bg-green-100 text-green-800 border-green-200" },
    }
    return styles[role] || { label: role, className: "bg-gray-100 text-gray-800 border-gray-200" }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            직원 관리
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            직원 계정 생성, 승인 및 권한 관리
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          신규 직원 추가
        </Button>
      </div>

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>성공</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>직원 목록</CardTitle>
          <CardDescription>총 {employees.length}명의 직원</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 직원이 없습니다.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>아이디</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>승인 상태</TableHead>
                    <TableHead>마지막 로그인</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const roleBadge = getRoleBadge(employee.role)
                    return (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          {employee.name || "-"}
                        </TableCell>
                        <TableCell>{employee.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {employee.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleBadge.className}>
                            {roleBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {employee.is_approved ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                              승인됨
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              대기중
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {employee.last_login
                            ? new Date(employee.last_login).toLocaleString("ko-KR")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(employee)}
                              title="정보 수정"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {!employee.is_approved && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(employee.id)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                승인
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePreview(employee.id, employee.name || employee.username)}
                              disabled={previewing}
                              title="화면 미리보기"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Employee Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>신규 직원 추가</DialogTitle>
            <DialogDescription>
              새로운 직원 계정을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">아이디 *</Label>
              <Input
                id="new-username"
                value={newEmployee.username}
                onChange={(e) => setNewEmployee({ ...newEmployee, username: e.target.value })}
                placeholder="employee1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">이메일 *</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="employee@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-name">이름</Label>
              <Input
                id="new-name"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                placeholder="홍길동"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">비밀번호 *</Label>
              <Input
                id="new-password"
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="********"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">역할</Label>
              <Select
                value={newEmployee.role}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
              >
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">직원</SelectItem>
                  <SelectItem value="operator">운영자</SelectItem>
                  <SelectItem value="ceo">대표</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={creating}
            >
              취소
            </Button>
            <Button onClick={handleCreateEmployee} disabled={creating}>
              {creating ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>직원 정보 수정</DialogTitle>
            <DialogDescription>
              직원의 이름, 역할 및 승인 상태를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedEmployee && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>아이디</Label>
                <Input value={selectedEmployee.username} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">이름</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="홍길동"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">역할</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">직원</SelectItem>
                    <SelectItem value="operator">운영자</SelectItem>
                    <SelectItem value="ceo">대표</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-approved"
                  checked={editForm.is_approved}
                  onChange={(e) => setEditForm({ ...editForm, is_approved: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-approved">계정 승인</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updating}
            >
              취소
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={updating}>
              {updating ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
