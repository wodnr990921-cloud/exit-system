"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { AuditLog, AuditActionCategory } from "@/lib/audit-logger"

interface AuditLogViewerProps {
  userRole: string
  userId?: string
  targetType?: string
  targetId?: string
  maxHeight?: string
}

export default function AuditLogViewer({
  userRole,
  userId,
  targetType,
  targetId,
  maxHeight = "600px",
}: AuditLogViewerProps) {
  const supabase = createClient()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadAuditLogs()
  }, [categoryFilter, statusFilter, userId, targetType, targetId])

  const loadAuditLogs = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      // Apply filters
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("action_category", categoryFilter)
      }

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      // If viewing for specific user
      if (userId && userRole === "staff") {
        query = query.eq("performed_by", userId)
      }

      // If viewing for specific target
      if (targetType && targetId) {
        query = query.eq("target_type", targetType).eq("target_id", targetId)
      }

      const { data, error } = await query

      if (error) throw error

      setLogs((data || []) as AuditLog[])
    } catch (error) {
      console.error("Error loading audit logs:", error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log)
    setShowDetails(true)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      finance: "bg-green-100 text-green-800 border-green-300",
      task: "bg-blue-100 text-blue-800 border-blue-300",
      betting: "bg-purple-100 text-purple-800 border-purple-300",
      user: "bg-orange-100 text-orange-800 border-orange-300",
      system: "bg-gray-100 text-gray-800 border-gray-300",
      procurement: "bg-cyan-100 text-cyan-800 border-cyan-300",
      logistics: "bg-indigo-100 text-indigo-800 border-indigo-300",
      qa: "bg-pink-100 text-pink-800 border-pink-300",
    }
    return colors[category] || "bg-gray-100 text-gray-800 border-gray-300"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case "partial":
        return <Clock className="w-4 h-4 text-yellow-600" />
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      finance: "재무",
      task: "업무",
      betting: "배팅",
      user: "사용자",
      system: "시스템",
      procurement: "발주",
      logistics: "배송",
      qa: "문의답변",
    }
    return labels[category] || category
  }

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      log.description.toLowerCase().includes(searchLower) ||
      log.target_identifier?.toLowerCase().includes(searchLower) ||
      log.performed_by_name?.toLowerCase().includes(searchLower) ||
      log.action_type.toLowerCase().includes(searchLower)
    )
  })

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>감사 로그</CardTitle>
                <CardDescription>
                  {targetType && targetId
                    ? "대상에 대한 전체 활동 기록"
                    : userRole === "staff"
                    ? "내 활동 기록"
                    : "시스템 전체 활동 기록"}
                </CardDescription>
              </div>
            </div>
            <Button onClick={loadAuditLogs} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="검색 (설명, 티켓번호, 사용자명...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 카테고리</SelectItem>
                <SelectItem value="finance">재무</SelectItem>
                <SelectItem value="task">업무</SelectItem>
                <SelectItem value="betting">배팅</SelectItem>
                <SelectItem value="user">사용자</SelectItem>
                <SelectItem value="system">시스템</SelectItem>
                <SelectItem value="procurement">발주</SelectItem>
                <SelectItem value="logistics">배송</SelectItem>
                <SelectItem value="qa">문의답변</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="success">성공</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
                <SelectItem value="partial">부분</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="mb-3 text-sm text-gray-600">
            총 <span className="font-semibold">{filteredLogs.length}</span>개의 로그
          </div>

          {/* Table */}
          <div className="border rounded-lg" style={{ maxHeight, overflowY: "auto" }}>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                로딩 중...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>감사 로그가 없습니다</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">상태</TableHead>
                    <TableHead className="w-[100px]">카테고리</TableHead>
                    <TableHead className="w-[180px]">일시</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="w-[150px]">수행자</TableHead>
                    <TableHead className="w-[120px]">대상</TableHead>
                    <TableHead className="w-[80px]">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell>{getStatusIcon(log.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCategoryColor(log.action_category)}>
                          {getCategoryLabel(log.action_category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2">{log.description}</div>
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1 line-clamp-1">
                            오류: {log.error_message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {log.performed_by_name || "알 수 없음"}
                        </div>
                        {log.performed_by_role && (
                          <div className="text-xs text-gray-500">{log.performed_by_role}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.target_identifier ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.target_identifier}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => handleViewDetails(log)}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>감사 로그 상세</DialogTitle>
            <DialogDescription>로그 ID: {selectedLog?.id}</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">액션 타입</div>
                  <div className="mt-1">{selectedLog.action_type}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">카테고리</div>
                  <div className="mt-1">
                    <Badge variant="outline" className={getCategoryColor(selectedLog.action_category)}>
                      {getCategoryLabel(selectedLog.action_category)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">수행자</div>
                  <div className="mt-1">
                    {selectedLog.performed_by_name || "알 수 없음"}{" "}
                    {selectedLog.performed_by_role && (
                      <span className="text-sm text-gray-500">({selectedLog.performed_by_role})</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">일시</div>
                  <div className="mt-1 text-sm">{formatDate(selectedLog.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">상태</div>
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusIcon(selectedLog.status)}
                    <span>{selectedLog.status}</span>
                  </div>
                </div>
                {selectedLog.target_identifier && (
                  <div>
                    <div className="text-sm font-medium text-gray-500">대상</div>
                    <div className="mt-1">
                      <Badge variant="outline" className="font-mono">
                        {selectedLog.target_identifier}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500">설명</div>
                <div className="mt-1 p-3 bg-gray-50 rounded">{selectedLog.description}</div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <div className="text-sm font-medium text-red-600">오류 메시지</div>
                  <div className="mt-1 p-3 bg-red-50 rounded text-red-800">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.old_value && (
                <div>
                  <div className="text-sm font-medium text-gray-500">이전 값</div>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_value && (
                <div>
                  <div className="text-sm font-medium text-gray-500">새로운 값</div>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <div className="text-sm font-medium text-gray-500">메타데이터</div>
                  <pre className="mt-1 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                {selectedLog.ip_address && (
                  <div>
                    <span className="font-medium">IP 주소:</span> {selectedLog.ip_address}
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div className="col-span-2">
                    <span className="font-medium">User Agent:</span> {selectedLog.user_agent}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
