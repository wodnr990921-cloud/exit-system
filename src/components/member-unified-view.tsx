"use client"

import React, { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  User,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Trophy,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Edit,
} from "lucide-react"

interface MemberUnifiedViewProps {
  customerId: string
  customerName: string
  memberNumber: string
}

interface CustomerDetails {
  id: string
  member_number: string
  name: string
  institution: string | null
  prison_number: string | null
  depositor_name: string | null
  mailbox_address: string | null
  total_point_general: number
  total_point_betting: number
  created_at: string
}

interface TaskRecord {
  id: string
  ticket_no: string
  title: string
  status: string
  total_amount: number
  created_at: string
  closed_at: string | null
  reply_content: string | null
}

interface PointHistoryRecord {
  id: string
  amount: number
  type: string
  category: string
  balance_after: number
  note: string | null
  created_at: string
  user: {
    name: string | null
  }
}

interface BettingRecord {
  id: string
  match_id: string
  amount: number
  betting_choice: string
  betting_odds: number
  potential_win: number
  status: string
  created_at: string
}

export default function MemberUnifiedView({
  customerId,
  customerName,
  memberNumber,
}: MemberUnifiedViewProps) {
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [pointHistory, setPointHistory] = useState<PointHistoryRecord[]>([])
  const [bettingRecords, setBettingRecords] = useState<BettingRecord[]>([])

  // 통계
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalBetting: 0,
    wonBetting: 0,
    lostBetting: 0,
    totalPointCharged: 0,
    totalPointUsed: 0,
  })

  // 편집 관련 상태
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    institution: "",
    prison_number: "",
    depositor_name: "",
    mailbox_address: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAllData()
  }, [customerId])

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadCustomerDetails(),
        loadTasks(),
        loadPointHistory(),
        loadBettingRecords(),
      ])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single()

      if (error) throw error
      setCustomerDetails(data)
    } catch (error) {
      console.error("Error loading customer details:", error)
    }
  }

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, ticket_no, title, status, total_amount, created_at, closed_at, reply_content")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })

      if (error) throw error

      const taskData = data || []
      setTasks(taskData)

      // 통계 계산
      setStats((prev) => ({
        ...prev,
        totalTasks: taskData.length,
        completedTasks: taskData.filter((t) => t.status === "closed").length,
        pendingTasks: taskData.filter((t) => t.status !== "closed").length,
      }))
    } catch (error) {
      console.error("Error loading tasks:", error)
    }
  }

  const loadPointHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("point_history")
        .select(`
          id,
          amount,
          type,
          category,
          balance_after,
          note,
          created_at,
          user:users!point_history_performed_by_fkey(name)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      const historyData = data || []
      setPointHistory(historyData as any)

      // 통계 계산
      const charged = historyData
        .filter((h) => h.type === "charge")
        .reduce((sum, h) => sum + h.amount, 0)
      const used = historyData
        .filter((h) => h.type === "deduct")
        .reduce((sum, h) => sum + Math.abs(h.amount), 0)

      setStats((prev) => ({
        ...prev,
        totalPointCharged: charged,
        totalPointUsed: used,
      }))
    } catch (error) {
      console.error("Error loading point history:", error)
    }
  }

  const loadBettingRecords = async () => {
    try {
      // task_items에서 배팅 관련 아이템 조회
      const { data, error } = await supabase
        .from("task_items")
        .select("*")
        .not("match_id", "is", null)
        .eq("category", "betting")
        .in("task_id", tasks.map((t) => t.id))
        .order("created_at", { ascending: false })

      if (error) throw error

      const bettingData = data || []
      setBettingRecords(bettingData as any)

      // 통계 계산
      const totalBet = bettingData.reduce((sum, b) => sum + (b.amount || 0), 0)
      const won = bettingData.filter((b) => b.status === "won").length
      const lost = bettingData.filter((b) => b.status === "lost").length

      setStats((prev) => ({
        ...prev,
        totalBetting: totalBet,
        wonBetting: won,
        lostBetting: lost,
      }))
    } catch (error) {
      console.error("Error loading betting records:", error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "decimal",
      minimumFractionDigits: 0,
    }).format(amount) + "원"
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

  const handleOpenEditDialog = () => {
    if (customerDetails) {
      setEditForm({
        name: customerDetails.name,
        institution: customerDetails.institution || "",
        prison_number: customerDetails.prison_number || "",
        depositor_name: customerDetails.depositor_name || "",
        mailbox_address: customerDetails.mailbox_address || "",
      })
      setShowEditDialog(true)
    }
  }

  const handleSaveEdit = async () => {
    if (!customerDetails) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          name: editForm.name.trim(),
          institution: editForm.institution.trim() || null,
          prison_number: editForm.prison_number.trim() || null,
          depositor_name: editForm.depositor_name.trim() || null,
          mailbox_address: editForm.mailbox_address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId)

      if (error) throw error

      toast({
        title: "저장 완료",
        description: "회원 정보가 수정되었습니다.",
      })

      setShowEditDialog(false)
      await loadCustomerDetails()
    } catch (error: any) {
      console.error("Error updating customer:", error)
      toast({
        variant: "destructive",
        title: "저장 실패",
        description: error.message || "회원 정보 수정에 실패했습니다.",
      })
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      pending: { label: "대기", variant: "outline" },
      approved: { label: "승인", variant: "default" },
      closed: { label: "완료", variant: "default" },
      rejected: { label: "거부", variant: "destructive" },
      won: { label: "당첨", variant: "default" },
      lost: { label: "낙첨", variant: "secondary" },
    }

    const config = statusMap[status] || { label: status, variant: "outline" }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-3">데이터 로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 회원 기본 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6" />
              <div>
                <CardTitle>{customerName}</CardTitle>
                <CardDescription>회원번호: {memberNumber}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpenEditDialog} variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                정보 수정
              </Button>
              <Button onClick={loadAllData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customerDetails && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">시설명</div>
                <div className="font-medium">{customerDetails.institution || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">수번</div>
                <div className="font-medium">{customerDetails.prison_number || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">일반 포인트</div>
                <div className="font-medium text-green-600">
                  {formatCurrency(customerDetails.total_point_general || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">베팅 포인트</div>
                <div className="font-medium text-blue-600">
                  {formatCurrency(customerDetails.total_point_betting || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">예금주</div>
                <div className="font-medium">{customerDetails.depositor_name || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">우편함 주소</div>
                <div className="font-medium">{customerDetails.mailbox_address || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">가입일</div>
                <div className="font-medium">{formatDate(customerDetails.created_at)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 티켓</CardDescription>
            <CardTitle className="text-3xl">{stats.totalTasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">
              완료: {stats.completedTasks} | 진행: {stats.pendingTasks}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 배팅</CardDescription>
            <CardTitle className="text-3xl">{stats.totalBetting}건</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">
              당첨: {stats.wonBetting} | 낙첨: {stats.lostBetting}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 충전</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {formatCurrency(stats.totalPointCharged)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">포인트 충전 누적</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 사용</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {formatCurrency(stats.totalPointUsed)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">포인트 사용 누적</div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 정보 탭 */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">
            <FileText className="w-4 h-4 mr-2" />
            티켓 이력 ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="points">
            <DollarSign className="w-4 h-4 mr-2" />
            포인트 이력 ({pointHistory.length})
          </TabsTrigger>
          <TabsTrigger value="betting">
            <Trophy className="w-4 h-4 mr-2" />
            배팅 이력 ({bettingRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* 티켓 이력 */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>티켓 이력</CardTitle>
              <CardDescription>모든 업무 티켓 내역</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>티켓번호</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead>완료일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        티켓이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono">{task.ticket_no}</TableCell>
                        <TableCell>{task.title || "-"}</TableCell>
                        <TableCell>{formatCurrency(task.total_amount || 0)}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{formatDate(task.created_at)}</TableCell>
                        <TableCell>{task.closed_at ? formatDate(task.closed_at) : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 포인트 이력 */}
        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle>포인트 이력</CardTitle>
              <CardDescription>충전/차감/당첨 내역 (최근 50건)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right">잔액</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead>처리자</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">
                        포인트 이력이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    pointHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.created_at)}</TableCell>
                        <TableCell>
                          {record.type === "charge" && (
                            <Badge variant="default" className="bg-green-600">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              충전
                            </Badge>
                          )}
                          {record.type === "deduct" && (
                            <Badge variant="destructive">
                              <TrendingDown className="w-3 h-3 mr-1" />
                              차감
                            </Badge>
                          )}
                          {record.type === "win" && (
                            <Badge variant="default" className="bg-blue-600">
                              <Trophy className="w-3 h-3 mr-1" />
                              당첨
                            </Badge>
                          )}
                          {record.type === "refund" && (
                            <Badge variant="outline">환불</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {record.category === "general" ? "일반" : "베팅"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            record.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {record.amount >= 0 ? "+" : ""}
                          {formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.balance_after)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {record.note || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(record.user as any)?.name || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 배팅 이력 */}
        <TabsContent value="betting">
          <Card>
            <CardHeader>
              <CardTitle>배팅 이력</CardTitle>
              <CardDescription>스포츠 배팅 내역</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일시</TableHead>
                    <TableHead>배팅 금액</TableHead>
                    <TableHead>배당률</TableHead>
                    <TableHead>예상 당첨금</TableHead>
                    <TableHead>선택</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bettingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        배팅 이력이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    bettingRecords.map((bet) => (
                      <TableRow key={bet.id}>
                        <TableCell>{formatDate(bet.created_at)}</TableCell>
                        <TableCell>{formatCurrency(bet.amount)}</TableCell>
                        <TableCell className="font-mono">{bet.betting_odds?.toFixed(2)}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(bet.potential_win || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bet.betting_choice}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(bet.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 정보 수정 다이얼로그 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>회원 정보 수정</DialogTitle>
            <DialogDescription>
              회원의 기본 정보를 수정합니다. 포인트는 별도로 관리됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">이름</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="회원 이름"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-institution">시설명</Label>
              <Input
                id="edit-institution"
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                placeholder="교정시설 이름"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prison-number">수번</Label>
              <Input
                id="edit-prison-number"
                value={editForm.prison_number}
                onChange={(e) => setEditForm({ ...editForm, prison_number: e.target.value })}
                placeholder="수형번호"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-depositor">예금주</Label>
              <Input
                id="edit-depositor"
                value={editForm.depositor_name}
                onChange={(e) => setEditForm({ ...editForm, depositor_name: e.target.value })}
                placeholder="입금자 이름"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mailbox">우편함 주소</Label>
              <Input
                id="edit-mailbox"
                value={editForm.mailbox_address}
                onChange={(e) => setEditForm({ ...editForm, mailbox_address: e.target.value })}
                placeholder="우편함 주소"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
