"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileText, Lock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"

interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string | null
  changes: any
  ip_address: string | null
  created_at: string
  users: {
    id: string
    username: string
    name: string | null
    email: string
    role: string
  } | null
}

export default function AuditLogsClient() {
  const { role, loading: permissionsLoading, hasPermission } = usePermissions()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [filterUserId, setFilterUserId] = useState<string>("")
  const [filterTable, setFilterTable] = useState<string>("")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const limit = 50

  useEffect(() => {
    if (!permissionsLoading) {
      loadLogs()
    }
  }, [permissionsLoading, filterUserId, filterTable, filterStartDate, filterEndDate, currentPage])

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      })

      if (filterUserId) params.append("userId", filterUserId)
      if (filterTable) params.append("tableName", filterTable)
      if (filterStartDate) params.append("startDate", filterStartDate)
      if (filterEndDate) params.append("endDate", filterEndDate)

      const response = await fetch(`/api/audit-logs?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "로그를 불러오는데 실패했습니다.")
      }

      setLogs(data.logs || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalLogs(data.pagination?.total || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    setExporting(true)
    const params = new URLSearchParams()
    if (filterUserId) params.append("userId", filterUserId)
    if (filterTable) params.append("tableName", filterTable)
    if (filterStartDate) params.append("startDate", filterStartDate)
    if (filterEndDate) params.append("endDate", filterEndDate)

    window.open(`/api/audit-logs/export?${params.toString()}`, "_blank")
    setTimeout(() => setExporting(false), 1000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
  }

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      create: "bg-green-100 text-green-800 border-green-200",
      update: "bg-blue-100 text-blue-800 border-blue-200",
      delete: "bg-red-100 text-red-800 border-red-200",
      SELECT: "bg-gray-100 text-gray-800 border-gray-200",
    }
    return styles[action] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  const resetFilters = () => {
    setFilterUserId("")
    setFilterTable("")
    setFilterStartDate("")
    setFilterEndDate("")
    setCurrentPage(1)
  }

  if (permissionsLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!hasPermission("admin")) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>접근 거부</AlertTitle>
          <AlertDescription>
            이 페이지는 관리자만 접근할 수 있습니다.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-indigo-600" />
            감사 로그
          </h1>
          <p className="text-muted-foreground mt-2">
            직원 활동 내역을 조회합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-indigo-600 border-indigo-600">
            Admin Only
          </Badge>
          <Button
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
            variant="success"
          >
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>조회 조건을 설정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>테이블</Label>
              <Select value={filterTable || undefined} onValueChange={(value) => setFilterTable(value || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="users">사용자</SelectItem>
                  <SelectItem value="customers">고객</SelectItem>
                  <SelectItem value="tasks">작업</SelectItem>
                  <SelectItem value="points">포인트</SelectItem>
                  <SelectItem value="system_config">시스템 설정</SelectItem>
                  <SelectItem value="customer_flags">고객 플래그</SelectItem>
                  <SelectItem value="inventory">재고</SelectItem>
                  <SelectItem value="settlements">정산</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={resetFilters} className="w-full">
                필터 초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>로그 목록</CardTitle>
              <CardDescription>총 {totalLogs.toLocaleString()}개의 로그</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">조회된 로그가 없습니다.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>작업</TableHead>
                    <TableHead>테이블</TableHead>
                    <TableHead>레코드 ID</TableHead>
                    <TableHead>IP 주소</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.users?.name || log.users?.username || "-"}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.users?.email || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActionBadge(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.table_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.record_id?.substring(0, 8) || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
