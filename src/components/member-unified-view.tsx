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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Plus,
  Minus,
  X,
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
  reply_sent_at: string | null
  ai_summary: string | null
  assignee: {
    name: string | null
  } | null
  closed_by_user: {
    name: string | null
  } | null
  task_items: Array<{
    id: string
    category: string
    description: string
    amount: number
    procurement_status: string | null
  }>
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

interface CartItem {
  id: string
  category: "book" | "game" | "goods" | "inquiry" | "complaint" | "other" | "complex"
  description: string
  amount: number
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

  // 티켓 상세 다이얼로그
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)

  // 포인트 지급/차감 다이얼로그
  const [showPointDialog, setShowPointDialog] = useState(false)
  const [pointAction, setPointAction] = useState<"charge" | "use">("charge")
  const [pointCategory, setPointCategory] = useState<"general" | "betting">("general")
  const [pointAmount, setPointAmount] = useState("")
  const [pointNote, setPointNote] = useState("")
  const [processingPoint, setProcessingPoint] = useState(false)

  // 티켓 작업 추가 (장바구니)
  const [itemCategory, setItemCategory] = useState<"book" | "game" | "goods" | "inquiry" | "complaint" | "other" | "complex">("book")
  const [itemDescription, setItemDescription] = useState("")
  const [itemAmount, setItemAmount] = useState("")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [addingItems, setAddingItems] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [savingReply, setSavingReply] = useState(false)

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
        .select(`
          id,
          ticket_no,
          title,
          status,
          total_amount,
          created_at,
          closed_at,
          reply_content,
          reply_sent_at,
          ai_summary,
          assignee:users!tasks_assignee_id_fkey(name),
          closed_by_user:users!tasks_closed_by_fkey(name),
          task_items(
            id,
            category,
            description,
            amount,
            procurement_status
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })

      if (error) throw error

      const taskData = data || []
      setTasks(taskData as any)

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

  const handleTaskClick = (task: TaskRecord) => {
    setSelectedTask(task)
    setShowTaskDialog(true)
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      book: "도서",
      game: "게임",
      goods: "물품",
      inquiry: "문의",
      betting: "베팅",
      other: "기타",
    }
    return labels[category] || category
  }

  const handlePointTransaction = async () => {
    if (!customerDetails || !pointAmount) return

    setProcessingPoint(true)
    try {
      const amount = pointAction === "use" ? -Math.abs(parseFloat(pointAmount)) : Math.abs(parseFloat(pointAmount))

      const { error } = await supabase.from("points").insert([
        {
          customer_id: customerId,
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

      // 데이터 새로고침
      await loadAllData()
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

  const handleAddToCart = () => {
    if (!itemDescription.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "내용을 입력해주세요.",
      })
      return
    }

    const amount = itemAmount ? parseInt(itemAmount) : 0

    const newItem: CartItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      category: itemCategory,
      description: itemDescription.trim(),
      amount: amount,
    }

    setCartItems([...cartItems, newItem])
    setItemDescription("")
    setItemAmount("")
  }

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId))
  }

  const handleSaveTaskAdditions = async () => {
    if (!selectedTask) return

    if (cartItems.length === 0 && !replyContent.trim()) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "추가할 항목이나 답변을 입력해주세요.",
      })
      return
    }

    setAddingItems(true)
    try {
      // 1. 장바구니 아이템이 있으면 task_items에 추가
      if (cartItems.length > 0) {
        const taskItems = cartItems.map((item) => ({
          task_id: selectedTask.id,
          category: item.category,
          description: item.description,
          amount: item.amount,
          procurement_status: "pending",
        }))

        const { error: itemsError } = await supabase.from("task_items").insert(taskItems)

        if (itemsError) throw itemsError
      }

      // 2. 답변 내용이 있으면 업데이트
      if (replyContent.trim()) {
        const { error: replyError } = await supabase
          .from("tasks")
          .update({
            reply_content: replyContent.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedTask.id)

        if (replyError) throw replyError
      }

      toast({
        title: "성공",
        description: "티켓에 작업이 추가되었습니다.",
      })

      // 초기화 및 새로고침
      setCartItems([])
      setItemDescription("")
      setItemAmount("")
      setReplyContent("")
      setShowTaskDialog(false)
      await loadTasks()
    } catch (error: any) {
      console.error("Error adding items to task:", error)
      toast({
        variant: "destructive",
        title: "오류",
        description: error.message || "작업 추가 중 오류가 발생했습니다.",
      })
    } finally {
      setAddingItems(false)
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
              <Button onClick={() => setShowPointDialog(true)} variant="outline" size="sm" className="border-green-600 text-green-600 hover:bg-green-50">
                <DollarSign className="w-4 h-4 mr-2" />
                포인트 지급/차감
              </Button>
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
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
                        onClick={() => handleTaskClick(task)}
                      >
                        <TableCell className="font-mono">{task.ticket_no}</TableCell>
                        <TableCell>{task.title || task.ai_summary || "-"}</TableCell>
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

      {/* 티켓 상세 다이얼로그 */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>티켓 상세 정보</DialogTitle>
            <DialogDescription>
              티켓번호: {selectedTask?.ticket_no}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6 py-4">
              {/* 회원 잔액 정보 */}
              {customerDetails && (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    회원 잔액
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 p-3 rounded shadow-sm">
                      <div className="text-xs text-gray-500 mb-1">일반 포인트</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(customerDetails.total_point_general || 0)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-3 rounded shadow-sm">
                      <div className="text-xs text-gray-500 mb-1">베팅 포인트</div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(customerDetails.total_point_betting || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 기본 정보 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">기본 정보</h4>
                  {getStatusBadge(selectedTask.status)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">생성일:</span>
                    <p className="font-medium">{formatDate(selectedTask.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">담당자:</span>
                    <p className="font-medium">{(selectedTask.assignee as any)?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">총 금액:</span>
                    <p className="font-medium text-blue-600">{formatCurrency(selectedTask.total_amount || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">마감일:</span>
                    <p className="font-medium">
                      {selectedTask.closed_at ? formatDate(selectedTask.closed_at) : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">답변 발송일:</span>
                    <p className="font-medium">
                      {selectedTask.reply_sent_at ? formatDate(selectedTask.reply_sent_at) : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">마감 처리자:</span>
                    <p className="font-medium">{(selectedTask.closed_by_user as any)?.name || "-"}</p>
                  </div>
                </div>
              </div>

              {/* AI 요약 */}
              {selectedTask.ai_summary && (
                <div className="space-y-2">
                  <h4 className="font-semibold">요약</h4>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.ai_summary}</p>
                  </div>
                </div>
              )}

              {/* 티켓 아이템 */}
              {selectedTask.task_items && selectedTask.task_items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">항목 내역</h4>
                  <div className="border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>분류</TableHead>
                          <TableHead>내용</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTask.task_items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.amount || 0)}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {item.procurement_status || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* 답변 내용 */}
              {selectedTask.reply_content && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">답변 내용</h4>
                    {selectedTask.reply_sent_at && (
                      <Badge variant="default" className="bg-green-600">
                        답변 발송 완료
                      </Badge>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.reply_content}</p>
                  </div>
                </div>
              )}

              {/* 답변 미작성 상태 */}
              {!selectedTask.reply_content && selectedTask.status !== "closed" && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    아직 답변이 작성되지 않았습니다.
                  </p>
                </div>
              )}

              {/* 작업 추가 영역 (티켓이 마감되지 않았을 때만) */}
              {selectedTask.status !== "closed" && (
                <div className="space-y-4 mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    작업 추가
                  </h4>

                  {/* 카테고리 선택 */}
                  <div className="space-y-2">
                    <Label>카테고리</Label>
                    <Select value={itemCategory} onValueChange={(value: any) => setItemCategory(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="book">도서</SelectItem>
                        <SelectItem value="game">경기 (베팅)</SelectItem>
                        <SelectItem value="goods">물품</SelectItem>
                        <SelectItem value="inquiry">문의</SelectItem>
                        <SelectItem value="complaint">민원</SelectItem>
                        <SelectItem value="other">기타</SelectItem>
                        <SelectItem value="complex">복합</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 설명 입력 */}
                  <div className="space-y-2">
                    <Label>
                      {itemCategory === "book" && "책 제목 또는 설명"}
                      {itemCategory === "game" && "경기 정보 (예: 맨유 승)"}
                      {itemCategory === "goods" && "물품 내용"}
                      {(itemCategory === "inquiry" || itemCategory === "complaint") && "내용"}
                      {(itemCategory === "other" || itemCategory === "complex") && "설명"}
                    </Label>
                    <Textarea
                      placeholder={
                        itemCategory === "book"
                          ? "예: 수학의 정석"
                          : itemCategory === "game"
                          ? "예: 맨유 승, 레알 승"
                          : "내용을 입력하세요"
                      }
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* 금액 입력 */}
                  <div className="space-y-2">
                    <Label>금액 (포인트)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={itemAmount}
                      onChange={(e) => setItemAmount(e.target.value)}
                    />
                  </div>

                  {/* 담기 버튼 */}
                  <Button onClick={handleAddToCart} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    장바구니에 담기
                  </Button>

                  {/* 장바구니 */}
                  {cartItems.length > 0 && (
                    <div className="space-y-2">
                      <Label>장바구니 ({cartItems.length}개)</Label>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>분류</TableHead>
                            <TableHead>내용</TableHead>
                            <TableHead className="text-right">금액</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cartItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">{item.description}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveFromCart(item.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="text-sm font-semibold text-right">
                        합계: {formatCurrency(cartItems.reduce((sum, item) => sum + item.amount, 0))}
                      </div>
                    </div>
                  )}

                  {/* 답변 작성 */}
                  <div className="space-y-2">
                    <Label>답변 내용 (선택)</Label>
                    <Textarea
                      placeholder="답변을 작성하세요..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={4}
                    />
                  </div>

                  {/* 저장 버튼 */}
                  <Button
                    onClick={handleSaveTaskAdditions}
                    disabled={addingItems || (cartItems.length === 0 && !replyContent.trim())}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {addingItems ? "저장 중..." : "작업 저장"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTaskDialog(false)
              setCartItems([])
              setItemDescription("")
              setItemAmount("")
              setReplyContent("")
            }}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 포인트 지급/차감 다이얼로그 */}
      <Dialog open={showPointDialog} onOpenChange={setShowPointDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>포인트 지급/차감</DialogTitle>
            <DialogDescription>
              {customerName} ({memberNumber})
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
    </div>
  )
}
