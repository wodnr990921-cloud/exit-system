"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface PointTransaction {
  id: string
  customer_id: string | null
  amount: number
  category: string
  type: string
  status: string
  reason: string | null
  requested_by: string | null
  approved_by: string | null
  created_at: string
  is_reversed: boolean
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
  customers: {
    member_number: string
    name: string
  } | null
  requested_by_user: {
    name: string
  } | null
  approved_by_user: {
    name: string
  } | null
  reversed_by_user: {
    name: string
  } | null
}

interface Customer {
  id: string
  member_number: string
  name: string
}

export default function PointsClient() {
  const router = useRouter()
  const [pendingTransactions, setPendingTransactions] = useState<PointTransaction[]>([])
  const [allTransactions, setAllTransactions] = useState<PointTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<PointTransaction | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [hasAccess, setHasAccess] = useState(false)
  const [showReverseDialog, setShowReverseDialog] = useState(false)
  const [reverseReason, setReverseReason] = useState("")
  const [reversing, setReversing] = useState(false)
  const [totalPoints, setTotalPoints] = useState({ general: 0, betting: 0 })
  const [showPointDialog, setShowPointDialog] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [newPointTransaction, setNewPointTransaction] = useState({
    customer_id: "",
    category: "",
    type: "",
    amount: "",
    reason: "",
  })
  const [processingPoint, setProcessingPoint] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    checkPermissions()
    loadPendingTransactions()
    loadAllTransactions()
    loadTotalPoints()
    loadCustomers()
    getCurrentUser()
  }, [])

  const checkPermissions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (data && (data.role === "ceo" || data.role === "operator" || data.role === "admin")) {
        setHasAccess(true)
      }
    } catch (error) {
      console.error("Error checking permissions:", error)
    }
  }

  const loadPendingTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("points")
        .select(
          `
          *,
          customers (member_number, name),
          requested_by_user:users!points_requested_by_fkey (name),
          approved_by_user:users!points_approved_by_fkey (name),
          reversed_by_user:users!points_reversed_by_fkey (name)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPendingTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading pending transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("points")
        .select(
          `
          *,
          customers (member_number, name),
          requested_by_user:users!points_requested_by_fkey (name),
          approved_by_user:users!points_approved_by_fkey (name),
          reversed_by_user:users!points_reversed_by_fkey (name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100) // Limit to recent 100 transactions for performance

      if (error) throw error
      setAllTransactions(data || [])
    } catch (error: any) {
      console.error("Error loading all transactions:", error)
    }
  }

  const loadTotalPoints = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("total_point_general, total_point_betting")

      if (error) throw error

      const total = (data || []).reduce(
        (acc, customer) => {
          acc.general += customer.total_point_general || 0
          acc.betting += customer.total_point_betting || 0
          return acc
        },
        { general: 0, betting: 0 }
      )

      setTotalPoints(total)
    } catch (error: any) {
      console.error("Error loading total points:", error)
    }
  }

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, member_number, name")
        .order("name", { ascending: true })

      if (error) throw error
      setCustomers(data || [])
    } catch (error: any) {
      console.error("Error loading customers:", error)
    }
  }

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error("Error getting current user:", error)
    }
  }

  const handlePointTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) {
      setError("로그인이 필요합니다.")
      return
    }

    if (!newPointTransaction.customer_id) {
      setError("회원을 선택해주세요.")
      return
    }

    if (!newPointTransaction.category) {
      setError("포인트 종류를 선택해주세요.")
      return
    }

    if (!newPointTransaction.type) {
      setError("유형을 선택해주세요.")
      return
    }

    if (!newPointTransaction.amount || parseInt(newPointTransaction.amount) <= 0) {
      setError("금액을 입력해주세요.")
      return
    }

    if (!newPointTransaction.reason.trim()) {
      setError("사유를 입력해주세요.")
      return
    }

    setProcessingPoint(true)
    setError(null)
    setSuccess(null)

    try {
      const category = newPointTransaction.category === "일반" ? "general" : "betting"

      // 유형 변환
      let type = ""
      switch (newPointTransaction.type) {
        case "지급":
          type = "charge"
          break
        case "차감":
          type = "use"
          break
        case "환불":
          type = "refund"
          break
        case "전환":
          type = "exchange"
          break
        default:
          throw new Error("유효하지 않은 유형입니다.")
      }

      // 먼저 고객 정보 조회
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("total_point_general, total_point_betting")
        .eq("id", newPointTransaction.customer_id)
        .single()

      if (customerError || !customer) throw new Error("회원 정보를 찾을 수 없습니다.")

      let newGeneral = customer.total_point_general || 0
      let newBetting = customer.total_point_betting || 0

      // 잔액 계산
      if (type === "charge" || type === "refund") {
        // 지급, 환불 = 포인트 증가
        if (category === "general") {
          newGeneral += parseInt(newPointTransaction.amount)
        } else {
          newBetting += parseInt(newPointTransaction.amount)
        }
      } else if (type === "use") {
        // 차감 = 포인트 감소
        if (category === "general") {
          newGeneral -= parseInt(newPointTransaction.amount)
          if (newGeneral < 0) throw new Error("일반 포인트 잔액이 부족합니다.")
        } else {
          newBetting -= parseInt(newPointTransaction.amount)
          if (newBetting < 0) throw new Error("배팅 포인트 잔액이 부족합니다.")
        }
      } else if (type === "exchange") {
        // 전환 = 한 종류에서 다른 종류로 이동
        if (category === "general") {
          // 일반에서 배팅으로
          newGeneral -= parseInt(newPointTransaction.amount)
          newBetting += parseInt(newPointTransaction.amount)
          if (newGeneral < 0) throw new Error("일반 포인트 잔액이 부족합니다.")
        } else {
          // 배팅에서 일반으로
          newBetting -= parseInt(newPointTransaction.amount)
          newGeneral += parseInt(newPointTransaction.amount)
          if (newBetting < 0) throw new Error("배팅 포인트 잔액이 부족합니다.")
        }
      }

      // 포인트 거래 기록 및 잔액 업데이트
      // amount는 타입에 따라 양수/음수로 저장
      let amountToStore = parseInt(newPointTransaction.amount)
      if (type === "use") {
        // 차감은 음수로 저장
        amountToStore = -Math.abs(amountToStore)
      } else if (type === "exchange") {
        // 전환도 음수로 저장 (빠져나가는 포인트)
        amountToStore = -Math.abs(amountToStore)
      }
      // charge, refund는 양수 그대로

      const { error: insertError } = await supabase.from("points").insert([
        {
          user_id: userId,
          customer_id: newPointTransaction.customer_id,
          category: category,
          type: type,
          amount: amountToStore,
          reason: newPointTransaction.reason.trim(),
          requested_by: userId,
          status: "approved", // 관리자가 직접 지급/차감하므로 즉시 승인
          approved_by: userId,
        },
      ])

      if (insertError) throw insertError

      // 잔액 업데이트
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          total_point_general: newGeneral,
          total_point_betting: newBetting,
        })
        .eq("id", newPointTransaction.customer_id)

      if (updateError) throw updateError

      setSuccess("포인트가 성공적으로 처리되었습니다.")
      setNewPointTransaction({ customer_id: "", category: "", type: "", amount: "", reason: "" })
      setShowPointDialog(false)
      loadPendingTransactions()
      loadAllTransactions()
      loadTotalPoints()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "포인트 처리에 실패했습니다.")
    } finally {
      setProcessingPoint(false)
    }
  }

  const handleApprove = async (transactionId: string) => {
    setApproving(true)
    setError(null)
    setSuccess(null)

    try {
      // API Route를 통해 승인 (알림 자동 생성)
      const response = await fetch("/api/points/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "승인에 실패했습니다.")
      }

      setSuccess("승인되었습니다.")
      // Reload data and customer balances
      loadPendingTransactions()
      loadAllTransactions()
      loadTotalPoints()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "승인에 실패했습니다.")
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedTransaction) return

    setApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("로그인이 필요합니다.")
      }

      const { error } = await supabase
        .from("points")
        .update({
          status: "rejected",
          approved_by: user.id,
          reason: rejectReason || selectedTransaction.reason || "거절됨",
        })
        .eq("id", selectedTransaction.id)

      if (error) throw error

      setSuccess("거절되었습니다.")
      setShowRejectDialog(false)
      setSelectedTransaction(null)
      setRejectReason("")

      loadPendingTransactions()
      loadAllTransactions()
      loadTotalPoints()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "거절에 실패했습니다.")
    } finally {
      setApproving(false)
    }
  }

  const handleReverseTransaction = async () => {
    if (!selectedTransaction) return

    setReversing(true)
    setError(null)
    setSuccess(null)

    try {
      if (!reverseReason.trim()) {
        throw new Error("취소 사유를 입력해주세요.")
      }

      const response = await fetch("/api/points/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          reason: reverseReason.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "거래 취소에 실패했습니다.")
      }

      setSuccess("거래가 취소되었습니다.")
      setShowReverseDialog(false)
      setSelectedTransaction(null)
      setReverseReason("")

      loadPendingTransactions()
      loadAllTransactions()
      loadTotalPoints()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (error: any) {
      setError(error.message || "거래 취소에 실패했습니다.")
    } finally {
      setReversing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR")
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString("ko-KR")
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "general":
        return "일반"
      case "betting":
        return "배팅"
      default:
        return cat
    }
  }

  const getTypeLabel = (t: string) => {
    switch (t) {
      case "charge":
        return "충전"
      case "use":
        return "사용"
      case "refund":
        return "환불"
      case "exchange":
        return "전환"
      default:
        return t
    }
  }

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "pending":
        return "승인대기"
      case "approved":
        return "승인완료"
      case "rejected":
        return "거절됨"
      default:
        return s
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case "pending":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      case "approved":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      case "rejected":
        return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()} className="border-gray-300 dark:border-gray-700">
              ← 뒤로가기
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")} className="border-gray-300 dark:border-gray-700">
              홈
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">포인트장부</h1>
          </div>
          {hasAccess && (
            <Button onClick={() => setShowPointDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              + 포인트 지급/차감
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 rounded-md">
            {success}
          </div>
        )}

        {/* 포인트 총합 표시 */}
        <Card className="mb-6 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">일반 포인트 총합</Label>
                <p className="mt-2 text-2xl font-semibold text-blue-600 dark:text-blue-400">{formatNumber(totalPoints.general)}원</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">배팅 포인트 총합</Label>
                <p className="mt-2 text-2xl font-semibold text-purple-600 dark:text-purple-400">{formatNumber(totalPoints.betting)}원</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="pending" disabled={!hasAccess}>
              승인 대기 {pendingTransactions.length > 0 && `(${pendingTransactions.length})`}
            </TabsTrigger>
            <TabsTrigger value="ledger">전체 장부</TabsTrigger>
          </TabsList>

          {/* Tab 1: 승인 대기 */}
          <TabsContent value="pending">
            {!hasAccess ? (
              <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">승인 권한이 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold">승인 대기</CardTitle>
                  <CardDescription>승인 대기 중인 포인트 거래 목록입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
                  ) : pendingTransactions.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 dark:text-gray-400">승인 대기 중인 거래가 없습니다.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">회원</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">포인트종류</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">유형</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">금액</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">사유</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">요청자</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">요청일시</TableHead>
                          <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <TableCell className="text-gray-900 dark:text-gray-50">
                              {transaction.customers
                                ? `${transaction.customers.member_number} - ${transaction.customers.name}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{getCategoryLabel(transaction.category)}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{getTypeLabel(transaction.type)}</TableCell>
                            <TableCell className={`font-medium ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {transaction.amount >= 0 ? '+' : ''}{formatNumber(transaction.amount)}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{transaction.reason || "-"}</TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {transaction.requested_by_user?.name || "-"}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">{formatDate(transaction.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(transaction.id)}
                                  disabled={approving}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  승인
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedTransaction(transaction)
                                    setShowRejectDialog(true)
                                  }}
                                  disabled={approving}
                                >
                                  거절
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: 전체 장부 */}
          <TabsContent value="ledger">
            <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">전체 장부</CardTitle>
                <CardDescription>모든 포인트 거래 내역입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">로딩 중...</div>
                ) : allTransactions.length === 0 ? (
                  <div className="text-center p-12 text-gray-500 dark:text-gray-400">거래 내역이 없습니다.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80 dark:bg-gray-800/50">
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">회원</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">포인트종류</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">유형</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">금액</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">상태</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">사유</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">요청자</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">승인자</TableHead>
                        <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">일시</TableHead>
                        {hasAccess && <TableHead className="text-sm font-semibold text-gray-700 dark:text-gray-300">작업</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTransactions.map((transaction) => {
                        const isReversed = transaction.is_reversed
                        const canReverse = transaction.status === "approved" && !isReversed

                        return (
                          <TableRow
                            key={transaction.id}
                            className={`border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 ${
                              isReversed ? "bg-red-50/50 dark:bg-red-950/20" : ""
                            }`}
                          >
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50"}>
                              {transaction.customers
                                ? `${transaction.customers.member_number} - ${transaction.customers.name}`
                                : "-"}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {getCategoryLabel(transaction.category)}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {getTypeLabel(transaction.type)}
                            </TableCell>
                            <TableCell className={`font-medium ${
                              isReversed
                                ? "text-red-600 dark:text-red-400 line-through"
                                : transaction.amount >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}>
                              {!isReversed && transaction.amount >= 0 ? '+' : ''}{formatNumber(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              {isReversed ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                                  취소됨
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(transaction.status)}`}>
                                  {getStatusLabel(transaction.status)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {isReversed && transaction.reversal_reason ? (
                                <div className="space-y-1">
                                  <div className="line-through">{transaction.reason || "-"}</div>
                                  <div className="text-xs text-red-600 dark:text-red-400">취소: {transaction.reversal_reason}</div>
                                </div>
                              ) : (
                                transaction.reason || "-"
                              )}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {transaction.requested_by_user?.name || "-"}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {transaction.approved_by_user?.name || "-"}
                            </TableCell>
                            <TableCell className={isReversed ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}>
                              {formatDate(transaction.created_at)}
                            </TableCell>
                            {hasAccess && (
                              <TableCell>
                                {canReverse && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedTransaction(transaction)
                                      setShowReverseDialog(true)
                                    }}
                                  >
                                    취소
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 거절 다이얼로그 */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">거절 사유 입력</DialogTitle>
              <DialogDescription>거절 사유를 입력해주세요.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">거절 사유</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="거절 사유를 입력하세요..."
                  rows={4}
                  className="border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={approving} className="border-gray-300 dark:border-gray-700">
                취소
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={approving || !rejectReason.trim()}>
                {approving ? "처리 중..." : "거절"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 거래 취소 다이얼로그 */}
        <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">거래 취소</DialogTitle>
              <DialogDescription>
                이 거래를 취소하시겠습니까? 포인트가 원래대로 복구됩니다.
              </DialogDescription>
            </DialogHeader>

            {selectedTransaction && (
              <div className="py-4 space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">회원:</span>
                    <span className="text-gray-900 dark:text-gray-50">
                      {selectedTransaction.customers
                        ? `${selectedTransaction.customers.member_number} - ${selectedTransaction.customers.name}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">포인트 종류:</span>
                    <span className="text-gray-900 dark:text-gray-50">{getCategoryLabel(selectedTransaction.category)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">유형:</span>
                    <span className="text-gray-900 dark:text-gray-50">{getTypeLabel(selectedTransaction.type)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">금액:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-50">{formatNumber(selectedTransaction.amount)}원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">원래 사유:</span>
                    <span className="text-gray-900 dark:text-gray-50">{selectedTransaction.reason || "-"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">취소 사유 *</Label>
                  <Textarea
                    value={reverseReason}
                    onChange={(e) => setReverseReason(e.target.value)}
                    placeholder="취소 사유를 입력하세요..."
                    rows={4}
                    className="border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReverseDialog(false)
                  setSelectedTransaction(null)
                  setReverseReason("")
                }}
                disabled={reversing}
                className="border-gray-300 dark:border-gray-700"
              >
                닫기
              </Button>
              <Button
                variant="destructive"
                onClick={handleReverseTransaction}
                disabled={reversing || !reverseReason.trim()}
              >
                {reversing ? "처리 중..." : "취소"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 포인트 지급/차감 다이얼로그 */}
        <Dialog open={showPointDialog} onOpenChange={setShowPointDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">포인트 지급/차감</DialogTitle>
              <DialogDescription>포인트를 지급하거나 차감합니다.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handlePointTransaction}>
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="point-customer" className="text-sm font-medium">회원 *</Label>
                  <Select
                    value={newPointTransaction.customer_id || undefined}
                    onValueChange={(value) => setNewPointTransaction({ ...newPointTransaction, customer_id: value || "" })}
                    disabled={processingPoint}
                  >
                    <SelectTrigger id="point-customer" className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="회원을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.member_number} - {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="point-category" className="text-sm font-medium">포인트 종류 *</Label>
                  <Select
                    value={newPointTransaction.category || undefined}
                    onValueChange={(value) => setNewPointTransaction({ ...newPointTransaction, category: value || "" })}
                    disabled={processingPoint}
                  >
                    <SelectTrigger id="point-category" className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="포인트 종류를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="일반">일반</SelectItem>
                      <SelectItem value="배팅">배팅</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="point-type" className="text-sm font-medium">유형 *</Label>
                  <Select
                    value={newPointTransaction.type || undefined}
                    onValueChange={(value) => setNewPointTransaction({ ...newPointTransaction, type: value || "" })}
                    disabled={processingPoint}
                  >
                    <SelectTrigger id="point-type" className="border-gray-300 dark:border-gray-700">
                      <SelectValue placeholder="유형을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="지급">지급</SelectItem>
                      <SelectItem value="차감">차감</SelectItem>
                      <SelectItem value="환불">환불</SelectItem>
                      <SelectItem value="전환">전환</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="point-amount" className="text-sm font-medium">금액 *</Label>
                  <Input
                    id="point-amount"
                    type="number"
                    placeholder="금액을 입력하세요"
                    value={newPointTransaction.amount}
                    onChange={(e) => setNewPointTransaction({ ...newPointTransaction, amount: e.target.value })}
                    disabled={processingPoint}
                    className="border-gray-300 dark:border-gray-700"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="point-reason" className="text-sm font-medium">사유 *</Label>
                  <Textarea
                    id="point-reason"
                    placeholder="사유를 입력하세요"
                    value={newPointTransaction.reason}
                    onChange={(e) => setNewPointTransaction({ ...newPointTransaction, reason: e.target.value })}
                    rows={4}
                    disabled={processingPoint}
                    className="border-gray-300 dark:border-gray-700"
                    required
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-md">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 rounded-md">
                    {success}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPointDialog(false)
                    setNewPointTransaction({ customer_id: "", category: "", type: "", amount: "", reason: "" })
                    setError(null)
                    setSuccess(null)
                  }}
                  disabled={processingPoint}
                  className="border-gray-300 dark:border-gray-700"
                >
                  취소
                </Button>
                <Button type="submit" disabled={processingPoint || !userId} className="bg-blue-600 hover:bg-blue-700">
                  {processingPoint ? "처리 중..." : "처리"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
